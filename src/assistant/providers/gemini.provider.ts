import {
  ApiError,
  Content,
  FunctionCall,
  GenerateContentResponse,
  GoogleGenAI,
  Part,
  Tool,
} from '@google/genai';
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
  SYSTEM_PROMPT,
  TOOL_DESCRIPTION,
  TOOL_NAME,
  ToolOutcome,
  runConvertCurrency,
  toolInputSchema,
} from '../currency-tool';
import { AssistantResponseDto } from '../dto';
import { AssistantProvider } from './assistant-provider';

export const GEMINI_CLIENT = Symbol('GEMINI_CLIENT');

// 2026-09-26: gemini-2.5-flash ainda aparecia em models.list, mas a API responde 404 para chaves
// novas ("no longer available to new users") e recomenda o 3.8 Flash.
const DEFAULT_MODEL = 'gemini-3.8-flash';

@Injectable()
export class GeminiProvider implements AssistantProvider {
  readonly name = 'gemini';
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly model: string;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly client: GoogleGenAI | null,
    private readonly conversionService: ConversionService,
    private readonly configService: ConfigService,
  ) {
    this.model = this.configService.get<string>('GEMINI_MODEL') || DEFAULT_MODEL;
  }

  get available(): boolean {
    return this.client !== null;
  }

  async ask(question: string): Promise<AssistantResponseDto> {
    if (!this.client) {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Assistente indisponível',
        error: 'Configure GEMINI_API_KEY no .env para usar o Gemini',
      });
    }

    const tools: Tool[] = [
      {
        functionDeclarations: [
          {
            name: TOOL_NAME,
            description: TOOL_DESCRIPTION,
            parametersJsonSchema: toolInputSchema(this.conversionService.getSupportedCurrencies()),
          },
        ],
      },
    ];
    const contents: Content[] = [{ role: 'user', parts: [{ text: question }] }];
    const conversions: ConversionResponseDto[] = [];

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await this.callModel(this.client, contents, tools);
      const calls = response.functionCalls ?? [];

      if (calls.length === 0) {
        return {
          answer: this.textOf(response) || 'Não consegui montar uma resposta.',
          conversions,
          model: this.model,
        };
      }

      // Devolve o turno do modelo como veio: nos modelos com raciocínio, as partes carregam a
      // assinatura do pensamento (thoughtSignature), que o Gemini exige de volta na chamada seguinte
      const modelTurn = response.candidates?.[0]?.content;
      if (modelTurn) {
        contents.push(modelTurn);
      }

      const parts: Part[] = [];
      for (const call of calls) {
        parts.push(await this.runTool(call, conversions));
      }
      // Todas as respostas de função numa única mensagem, na mesma ordem das chamadas
      contents.push({ role: 'user', parts });
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

  private async callModel(
    client: GoogleGenAI,
    contents: Content[],
    tools: Tool[],
  ): Promise<GenerateContentResponse> {
    try {
      return await client.models.generateContent({
        model: this.model,
        contents,
        config: { systemInstruction: SYSTEM_PROMPT, tools },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private async runTool(call: FunctionCall, conversions: ConversionResponseDto[]): Promise<Part> {
    const outcome: ToolOutcome =
      call.name === TOOL_NAME
        ? await runConvertCurrency(this.conversionService, call.args)
        : { ok: false, content: `Ferramenta desconhecida: ${call.name}` };
    if (outcome.conversion) {
      conversions.push(outcome.conversion);
    } else {
      this.logger.warn(`convert_currency falhou: ${outcome.content}`);
    }
    return {
      functionResponse: {
        ...(call.id ? { id: call.id } : {}),
        name: call.name ?? TOOL_NAME,
        // o Gemini espera um objeto: "output" com o resultado ou "error" com o motivo
        response: outcome.ok ? { output: JSON.parse(outcome.content) } : { error: outcome.content },
      },
    };
  }

  private textOf(response: GenerateContentResponse): string {
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return parts
      .filter((part) => part.text && !part.thought)
      .map((part) => part.text)
      .join('')
      .trim();
  }

  private toHttpException(error: unknown): HttpException {
    const status = error instanceof ApiError ? error.status : undefined;
    if (status === 400 && /api key|API_KEY/i.test(String((error as Error).message))) {
      return this.unavailable();
    }
    if (status === 401 || status === 403) {
      return this.unavailable();
    }
    if (status === 404) {
      // modelo configurado não existe (ou foi fechado para esta chave): erro de configuração, não do usuário
      this.logger.error(`Modelo do Gemini indisponível (${this.model}): ${error}`);
      return new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Assistente indisponível',
        error: `O modelo ${this.model} não está disponível para esta chave; ajuste GEMINI_MODEL`,
      });
    }
    if (status === 429) {
      return new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Limite de uso do assistente atingido',
          error: 'Cota do Gemini esgotada no momento; tente novamente em alguns segundos',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.logger.error(`Erro ao consultar o Gemini (${status ?? 'sem status'}): ${error}`);
    return new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'Erro ao consultar o assistente',
        error: 'Tente novamente em instantes',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: 'Assistente indisponível',
      error: 'A chave da API do Gemini é inválida ou não tem permissão',
    });
  }
}
