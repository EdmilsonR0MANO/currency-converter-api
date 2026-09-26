import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssistantService } from './assistant.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

describe('AssistantService', () => {
  const fakeProvider = (name: string, available: boolean) => ({
    name,
    available,
    ask: jest.fn().mockResolvedValue({ answer: name, conversions: [], model: name }),
  });

  const build = (wanted: string | undefined, gemini: boolean, anthropic: boolean) => {
    const g = fakeProvider('gemini', gemini);
    const a = fakeProvider('anthropic', anthropic);
    const config = { get: jest.fn().mockReturnValue(wanted) } as unknown as ConfigService;
    const service = new AssistantService(
      a as unknown as AnthropicProvider,
      g as unknown as GeminiProvider,
      config,
    );
    return { service, g, a };
  };

  it('usa o provedor pedido em ASSISTANT_PROVIDER', async () => {
    const { service, a } = build('anthropic', true, true);

    await service.ask('oi');

    expect(service.providerName).toBe('anthropic');
    expect(a.ask).toHaveBeenCalledWith('oi');
  });

  it('sem ASSISTANT_PROVIDER, usa o primeiro com chave (Gemini antes do Claude)', () => {
    expect(build(undefined, true, true).service.providerName).toBe('gemini');
    expect(build(undefined, false, true).service.providerName).toBe('anthropic');
  });

  it('responde 503 quando nenhum provedor tem chave', async () => {
    const { service } = build(undefined, false, false);

    await expect(service.ask('oi')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('responde 503 quando ASSISTANT_PROVIDER aponta para um provedor desconhecido', async () => {
    const { service } = build('openai', true, true);

    await expect(service.ask('oi')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
