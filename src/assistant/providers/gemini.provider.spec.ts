import { ApiError } from '@google/genai';
import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ConversionService } from '../../conversion/services/conversion.service';
import { GEMINI_CLIENT, GeminiProvider } from './gemini.provider';

// Respostas do Gemini no formato do SDK (só os campos que o provedor lê)
const functionCall = (args: Record<string, unknown>, id = 'call_1') => {
  const call = { id, name: 'convert_currency', args };
  return {
    functionCalls: [call],
    candidates: [
      { content: { role: 'model', parts: [{ functionCall: call, thoughtSignature: 'sig' }] } },
    ],
  };
};
const finalText = (text: string) => ({
  functionCalls: undefined,
  candidates: [{ content: { role: 'model', parts: [{ text }] } }],
});

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let generateContent: jest.Mock;
  let convert: jest.Mock;

  const conversion = {
    from: 'USD',
    to: 'BRL',
    originalAmount: 250,
    convertedAmount: 1346.25,
    exchangeRate: 5.385,
    fromCache: false,
    timestamp: '2026-09-26T18:00:00.000Z',
  };

  const build = async (client: unknown) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiProvider,
        { provide: GEMINI_CLIENT, useValue: client },
        {
          provide: ConversionService,
          useValue: {
            convert,
            getSupportedCurrencies: jest.fn().mockReturnValue(['BRL', 'EUR', 'USD']),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();
    return module.get<GeminiProvider>(GeminiProvider);
  };

  beforeEach(async () => {
    generateContent = jest.fn();
    convert = jest.fn().mockResolvedValue(conversion);
    provider = await build({ models: { generateContent } });
  });

  it('executa a função pedida pelo modelo e devolve a resposta com os números do serviço', async () => {
    generateContent
      .mockResolvedValueOnce(functionCall({ from: 'USD', to: 'BRL', amount: 250 }))
      .mockResolvedValueOnce(finalText('250 dólares dão R$ 1.346,25 (cotação 5,385).'));

    const result = await provider.ask('Quanto dá 250 dólares em reais?');

    expect(convert).toHaveBeenCalledWith({ from: 'USD', to: 'BRL', amount: 250 });
    expect(result).toEqual({
      answer: '250 dólares dão R$ 1.346,25 (cotação 5,385).',
      conversions: [conversion],
      model: 'gemini-3.8-flash',
    });

    const { contents } = generateContent.mock.calls[1][0];
    expect(contents).toHaveLength(3);
    // o turno do modelo volta como veio, com a assinatura do raciocínio
    expect(contents[1].parts[0].thoughtSignature).toBe('sig');
    expect(contents[2].parts[0].functionResponse).toEqual({
      id: 'call_1',
      name: 'convert_currency',
      response: { output: expect.objectContaining({ convertedAmount: 1346.25 }) },
    });
  });

  it('declara a função com o schema de moedas suportadas e o prompt de sistema', async () => {
    generateContent.mockResolvedValueOnce(finalText('Posso ajudar com conversões.'));

    await provider.ask('Oi');

    const params = generateContent.mock.calls[0][0];
    expect(params.model).toBe('gemini-3.8-flash');
    expect(params.config.systemInstruction).toContain('convert_currency');
    const [declaration] = params.config.tools[0].functionDeclarations;
    expect(declaration.name).toBe('convert_currency');
    expect(declaration.parametersJsonSchema.properties.from.enum).toEqual(['BRL', 'EUR', 'USD']);
  });

  it('responde sem converter quando a pergunta não é sobre moedas', async () => {
    generateContent.mockResolvedValueOnce(finalText('Só ajudo com conversões de moeda.'));

    const result = await provider.ask('Qual a capital da França?');

    expect(convert).not.toHaveBeenCalled();
    expect(result.conversions).toEqual([]);
  });

  it('devolve o erro da conversão ao modelo em response.error', async () => {
    convert.mockRejectedValueOnce(
      new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Erro de validação das moedas',
          errors: ['A moeda de origem e destino não podem ser iguais'],
        },
        HttpStatus.BAD_REQUEST,
      ),
    );
    generateContent
      .mockResolvedValueOnce(functionCall({ from: 'BRL', to: 'BRL', amount: 10 }))
      .mockResolvedValueOnce(finalText('Origem e destino são a mesma moeda.'));

    const result = await provider.ask('Quanto são 10 reais em reais?');

    const [part] = generateContent.mock.calls[1][0].contents[2].parts;
    expect(part.functionResponse.response.error).toContain('não podem ser iguais');
    expect(result.conversions).toEqual([]);
  });

  it('recusa valor inválido vindo do modelo sem chamar a conversão', async () => {
    generateContent
      .mockResolvedValueOnce(functionCall({ from: 'USD', to: 'BRL', amount: 0 }))
      .mockResolvedValueOnce(finalText('O valor precisa ser positivo.'));

    await provider.ask('Converta zero dólares');

    expect(convert).not.toHaveBeenCalled();
  });

  it('interrompe se o modelo pedir função além do limite de rodadas', async () => {
    generateContent.mockResolvedValue(functionCall({ from: 'USD', to: 'BRL', amount: 1 }));

    await expect(provider.ask('Converta sem parar')).rejects.toMatchObject({
      status: HttpStatus.BAD_GATEWAY,
    });
    expect(generateContent).toHaveBeenCalledTimes(5);
  });

  it('transforma cota esgotada (429) em resposta 429', async () => {
    generateContent.mockRejectedValueOnce(new ApiError({ message: 'quota', status: 429 }));

    await expect(provider.ask('Quanto dá 1 dólar em reais?')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('responde 503 com o nome do modelo quando ele não está disponível (404)', async () => {
    generateContent.mockRejectedValueOnce(
      new ApiError({ message: 'no longer available', status: 404 }),
    );

    await expect(provider.ask('Quanto dá 1 dólar em reais?')).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      response: expect.objectContaining({ error: expect.stringContaining('GEMINI_MODEL') }),
    });
  });

  it('responde 503 quando não há chave do Gemini configurada', async () => {
    const semChave = await build(null);

    await expect(semChave.ask('Quanto dá 1 dólar em reais?')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
