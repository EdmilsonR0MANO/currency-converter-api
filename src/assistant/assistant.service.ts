import Anthropic from '@anthropic-ai/sdk';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversionService } from '../conversion/services/conversion.service';
import { ConversionResponseDto } from '../conversion/dto';
import { AssistantResponseDto } from './dto';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_EFFORT = 'low';
// Cada volta é uma ida ao modelo. Uma pergunta normal usa 2 (pede a conversão, depois responde);
// o limite evita laço infinito se o modelo insistir em chamar a ferramenta.
const MAX_ROUNDS = 5;

const SYSTEM_PROMPT = [
  'Você é o assistente da API de conversão de moedas.',
  'Para qualquer valor em outra moeda, chame a ferramenta convert_currency: nunca calcule câmbio de cabeça nem invente cotação.',
  'Responda em português do Brasil, em até duas frases, com o valor convertido e a cotação usada.',
  'Se a pergunta não for sobre conversão de moedas, diga que só ajuda com conversões.',
].join(' ');

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

interface ConvertInput {
  from?: unknown;
  to?: unknown;
  amount?: unknown;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly model: string;
  private readonly effort?: Effort;
  private readonly useFallbacks: boolean;

  constructor(
    @Inject(ANTHROPIC_CLIENT) private readonly client: Anthropic | null,
    private readonly conversionService: ConversionService,
    private readonly configService: ConfigService,
  ) {
    this.model = this.configService.get<string>('ASSISTANT_MODEL') || DEFAULT_MODEL;
    // ASSISTANT_EFFORT vazio desliga o parâmetro (modelos antigos, como o Haiku 4.5, não aceitam effort)
    const effort = this.configService.get<string>('ASSISTANT_EFFORT') ?? DEFAULT_EFFORT;
    this.effort = effort ? (effort as Effort) : undefined;
    this.useFallbacks = this.configService.get<string>('ASSISTANT_FALLBACKS') !== 'off';
  }

  /**
   * Responde uma pergunta em linguagem natural. O modelo decide quando chamar a ferramenta
   * convert_currency; quem calcula é o ConversionService (cotação real, com cache).
   */
  async ask(question: string): Promise<AssistantResponseDto> {
    if (!this.client) {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Assistente indisponível',
        error: 'Configure ANTHROPIC_API_KEY no .env para usar o assistente',
      });
    }

    const tools = this.buildTools();
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: question }];
    const conversions: ConversionResponseDto[] = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await this.callModel(this.client, messages, tools);

      if (response.stop_reason === 'refusal') {
        return {
          answer: 'Não consigo ajudar com esse pedido. Posso converter valores entre moedas.',
          conversions,
          model: response.model,
        };
      }

      if (response.stop_reason !== 'tool_use') {
        return {
          answer: this.textOf(response.content) || 'Não consegui montar uma resposta.',
          conversions,
          model: response.model,
        };
      }

      // Devolve o turno do modelo inteiro (inclusive blocos de raciocínio) antes dos resultados
      messages.push({ role: 'assistant', content: response.content });

      const calls = response.content.filter(
        (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use',
      );
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        results.push(await this.runTool(call, conversions));
      }
      // Todos os resultados numa única mensagem: separar ensina o modelo a não chamar em paralelo
      messages.push({ role: 'user', content: results });
    }

    throw new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'O assistente não concluiu a resposta',
        error: `O modelo pediu mais de ${MAX_ROUNDS} rodadas de ferramenta`,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  private buildTools(): Anthropic.Beta.BetaTool[] {
    const currencies = this.conversionService.getSupportedCurrencies();
    return [
      {
        name: 'convert_currency',
        description:
          'Converte um valor entre duas moedas com a cotação atual (AwesomeAPI, com cache de 2 minutos). ' +
          'Use códigos ISO 4217: dólar americano = USD, real = BRL, euro = EUR, libra = GBP, bitcoin = BTC.',
        // strict: o modelo só consegue chamar com os três campos e com moedas desta lista
        strict: true,
        input_schema: {
          type: 'object',
          properties: {
            from: { type: 'string', enum: currencies, description: 'Moeda de origem' },
            to: { type: 'string', enum: currencies, description: 'Moeda de destino' },
            amount: { type: 'number', description: 'Valor na moeda de origem, maior que zero' },
          },
          required: ['from', 'to', 'amount'],
          additionalProperties: false,
        },
      },
    ];
  }

  private async callModel(
    client: Anthropic,
    messages: Anthropic.Beta.BetaMessageParam[],
    tools: Anthropic.Beta.BetaTool[],
  ): Promise<Anthropic.Beta.BetaMessage> {
    try {
      return await client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools,
        messages,
        // Pergunta curta e uma ferramenta só: esforço baixo responde rápido e gasta menos
        ...(this.effort ? { output_config: { effort: this.effort } } : {}),
        // Se o modelo recusar por política, a API refaz o pedido no modelo de reserva recomendado
        ...(this.useFallbacks
          ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
          : {}),
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private async runTool(
    call: Anthropic.Beta.BetaToolUseBlock,
    conversions: ConversionResponseDto[],
  ): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
    const fail = (content: string): Anthropic.Beta.BetaToolResultBlockParam => ({
      type: 'tool_result',
      tool_use_id: call.id,
      is_error: true,
      content,
    });

    if (call.name !== 'convert_currency') {
      return fail(`Ferramenta desconhecida: ${call.name}`);
    }

    // Entrada do modelo é dado externo: valida de novo, mesmo com strict
    const input = (call.input ?? {}) as ConvertInput;
    const from = String(input.from ?? '').toUpperCase();
    const to = String(input.to ?? '').toUpperCase();
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail('O valor a converter deve ser um número maior que zero');
    }

    try {
      const result = await this.conversionService.convert({ from, to, amount });
      conversions.push(result);
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        content: JSON.stringify({
          from: result.from,
          to: result.to,
          originalAmount: result.originalAmount,
          convertedAmount: result.convertedAmount,
          exchangeRate: result.exchangeRate,
          timestamp: result.timestamp,
        }),
      };
    } catch (error) {
      const message = this.describeError(error);
      this.logger.warn(`convert_currency falhou (${from}->${to}): ${message}`);
      return fail(message);
    }
  }

  private describeError(error: unknown): string {
    if (!(error instanceof HttpException)) {
      return 'Falha inesperada ao converter';
    }
    const body = error.getResponse();
    if (typeof body === 'string') {
      return body;
    }
    const { message, errors } = body as { message?: string; errors?: string[] };
    return [message, ...(errors ?? [])].filter(Boolean).join(': ') || error.message;
  }

  private textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
    return content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
  }

  private toHttpException(error: unknown): HttpException {
    if (
      error instanceof Anthropic.AuthenticationError ||
      error instanceof Anthropic.PermissionDeniedError
    ) {
      return new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Assistente indisponível',
        error: 'A chave da API do Claude é inválida ou não tem permissão',
      });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Limite de uso do assistente atingido',
          error: 'Tente novamente em alguns segundos',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (error instanceof Anthropic.APIError) {
      this.logger.error(
        `Erro da API do Claude (${error.status ?? 'sem status'}): ${error.message}`,
      );
    } else {
      this.logger.error(`Erro inesperado no assistente: ${error}`);
    }
    return new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'Erro ao consultar o assistente',
        error: 'Tente novamente em instantes',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
