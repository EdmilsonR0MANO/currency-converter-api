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
import { ConversionResponseDto } from '../../conversion/dto';
import { ConversionService } from '../../conversion/services/conversion.service';
import {
  MAX_ROUNDS,
  REFUSAL_ANSWER,
  SYSTEM_PROMPT,
  TOOL_DESCRIPTION,
  TOOL_NAME,
  runConvertCurrency,
  toolInputSchema,
} from '../currency-tool';
import { AssistantResponseDto } from '../dto';
import { AssistantProvider } from './assistant-provider';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_EFFORT = 'low';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

@Injectable()
export class AnthropicProvider implements AssistantProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
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

  get available(): boolean {
    return this.client !== null;
  }

  async ask(question: string): Promise<AssistantResponseDto> {
    if (!this.client) {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Assistente indisponível',
        error: 'Configure ANTHROPIC_API_KEY no .env para usar o Claude',
      });
    }

    const tools = this.buildTools();
    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: question }];
    const conversions: ConversionResponseDto[] = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await this.callModel(this.client, messages, tools);

      if (response.stop_reason === 'refusal') {
        return { answer: REFUSAL_ANSWER, conversions, model: response.model };
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
    return [
      {
        name: TOOL_NAME,
        description: TOOL_DESCRIPTION,
        // strict: o modelo só consegue chamar com os três campos e com moedas desta lista
        strict: true,
        input_schema: toolInputSchema(this.conversionService.getSupportedCurrencies()),
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
    if (call.name !== TOOL_NAME) {
      return {
        type: 'tool_result',
        tool_use_id: call.id,
        is_error: true,
        content: `Ferramenta desconhecida: ${call.name}`,
      };
    }
    const outcome = await runConvertCurrency(this.conversionService, call.input);
    if (outcome.conversion) {
      conversions.push(outcome.conversion);
    } else {
      this.logger.warn(`convert_currency falhou: ${outcome.content}`);
    }
    return {
      type: 'tool_result',
      tool_use_id: call.id,
      content: outcome.content,
      ...(outcome.ok ? {} : { is_error: true }),
    };
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
