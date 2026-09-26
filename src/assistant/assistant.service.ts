import { HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantResponseDto } from './dto';
import { AnthropicProvider } from './providers/anthropic.provider';
import { AssistantProvider } from './providers/assistant-provider';
import { GeminiProvider } from './providers/gemini.provider';

/**
 * Escolhe o provedor do assistente. ASSISTANT_PROVIDER=anthropic|gemini força um; vazio usa o
 * primeiro que tiver chave configurada (Gemini, depois Claude).
 */
@Injectable()
export class AssistantService {
  private readonly provider: AssistantProvider | null;

  constructor(anthropic: AnthropicProvider, gemini: GeminiProvider, configService: ConfigService) {
    const wanted = (configService.get<string>('ASSISTANT_PROVIDER') || '').trim().toLowerCase();
    const providers: AssistantProvider[] = [gemini, anthropic];
    this.provider = wanted
      ? (providers.find((p) => p.name === wanted) ?? null)
      : (providers.find((p) => p.available) ?? null);
  }

  get providerName(): string | null {
    return this.provider?.name ?? null;
  }

  async ask(question: string): Promise<AssistantResponseDto> {
    if (!this.provider) {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Assistente indisponível',
        error:
          'Configure GEMINI_API_KEY ou ANTHROPIC_API_KEY no .env (ASSISTANT_PROVIDER escolhe qual usar)',
      });
    }
    return this.provider.ask(question);
  }
}
