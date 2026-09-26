import { HttpException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConversionService } from '../../conversion/services/conversion.service';
import { ANTHROPIC_CLIENT, AnthropicProvider } from './anthropic.provider';

// Respostas do modelo no formato da API (só os campos que o serviço lê)
const toolUse = (input: Record<string, unknown>, id = 'toolu_1') => ({
  model: 'claude-opus-5',
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', id, name: 'convert_currency', input }],
});
const finalText = (text: string) => ({
  model: 'claude-opus-5',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text }],
});

describe('AnthropicProvider', () => {
  let service: AnthropicProvider;
  let create: jest.Mock;
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
        AnthropicProvider,
        { provide: ANTHROPIC_CLIENT, useValue: client },
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
    return module.get<AnthropicProvider>(AnthropicProvider);
  };

  beforeEach(async () => {
    create = jest.fn();
    convert = jest.fn().mockResolvedValue(conversion);
    service = await build({ beta: { messages: { create } } });
  });

  it('chama a conversão pedida pelo modelo e devolve a resposta com os números do serviço', async () => {
    create
      .mockResolvedValueOnce(toolUse({ from: 'USD', to: 'BRL', amount: 250 }))
      .mockResolvedValueOnce(finalText('250 dólares dão R$ 1.346,25 (cotação 5,385).'));

    const result = await service.ask('Quanto dá 250 dólares em reais?');

    expect(convert).toHaveBeenCalledWith({ from: 'USD', to: 'BRL', amount: 250 });
    expect(result.answer).toBe('250 dólares dão R$ 1.346,25 (cotação 5,385).');
    expect(result.conversions).toEqual([conversion]);

    // 2ª ida ao modelo leva o turno dele + o resultado da ferramenta, ligado pelo tool_use_id
    const second = create.mock.calls[1][0];
    expect(second.messages).toHaveLength(3);
    const [toolResult] = second.messages[2].content;
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1' });
    expect(toolResult.is_error).toBeUndefined();
    expect(JSON.parse(toolResult.content)).toMatchObject({ convertedAmount: 1346.25 });
  });

  it('declara a ferramenta com strict e só as moedas suportadas, com fallback e esforço baixo', async () => {
    create.mockResolvedValueOnce(finalText('Posso ajudar com conversões.'));

    await service.ask('Oi');

    const params = create.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-5');
    expect(params.output_config).toEqual({ effort: 'low' });
    expect(params.fallbacks).toBe('default');
    expect(params.betas).toEqual(['server-side-fallback-2026-07-01']);
    const [tool] = params.tools;
    expect(tool.name).toBe('convert_currency');
    expect(tool.strict).toBe(true);
    expect(tool.input_schema.properties.from.enum).toEqual(['BRL', 'EUR', 'USD']);
  });

  it('responde sem converter quando a pergunta não é sobre moedas', async () => {
    create.mockResolvedValueOnce(finalText('Só ajudo com conversões de moeda.'));

    const result = await service.ask('Qual a capital da França?');

    expect(convert).not.toHaveBeenCalled();
    expect(result.conversions).toEqual([]);
    expect(result.answer).toBe('Só ajudo com conversões de moeda.');
  });

  it('devolve o erro da conversão ao modelo como tool_result com is_error', async () => {
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
    create
      .mockResolvedValueOnce(toolUse({ from: 'BRL', to: 'BRL', amount: 10 }))
      .mockResolvedValueOnce(
        finalText('Origem e destino são a mesma moeda: 10 reais são 10 reais.'),
      );

    const result = await service.ask('Quanto são 10 reais em reais?');

    const [toolResult] = create.mock.calls[1][0].messages[2].content;
    expect(toolResult.is_error).toBe(true);
    expect(toolResult.content).toContain('não podem ser iguais');
    expect(result.conversions).toEqual([]);
  });

  it('recusa valor inválido vindo do modelo sem chamar a conversão', async () => {
    create
      .mockResolvedValueOnce(toolUse({ from: 'USD', to: 'BRL', amount: -5 }))
      .mockResolvedValueOnce(finalText('O valor precisa ser positivo.'));

    await service.ask('Converta menos 5 dólares');

    expect(convert).not.toHaveBeenCalled();
    const [toolResult] = create.mock.calls[1][0].messages[2].content;
    expect(toolResult).toMatchObject({ is_error: true });
  });

  it('executa várias conversões pedidas no mesmo turno e devolve todas numa mensagem', async () => {
    create
      .mockResolvedValueOnce({
        model: 'claude-opus-5',
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'a',
            name: 'convert_currency',
            input: { from: 'EUR', to: 'USD', amount: 100 },
          },
          {
            type: 'tool_use',
            id: 'b',
            name: 'convert_currency',
            input: { from: 'EUR', to: 'BRL', amount: 100 },
          },
        ],
      })
      .mockResolvedValueOnce(finalText('100 euros dão X dólares e Y reais.'));

    const result = await service.ask('Quanto são 100 euros em dólar e em real?');

    expect(convert).toHaveBeenCalledTimes(2);
    expect(result.conversions).toHaveLength(2);
    const results = create.mock.calls[1][0].messages[2].content;
    expect(results.map((r: { tool_use_id: string }) => r.tool_use_id)).toEqual(['a', 'b']);
  });

  it('responde com mensagem fixa quando o modelo recusa', async () => {
    create.mockResolvedValueOnce({ model: 'claude-opus-5', stop_reason: 'refusal', content: [] });

    const result = await service.ask('...');

    expect(result.answer).toContain('Não consigo ajudar');
  });

  it('interrompe se o modelo pedir ferramenta além do limite de rodadas', async () => {
    create.mockResolvedValue(toolUse({ from: 'USD', to: 'BRL', amount: 1 }));

    await expect(service.ask('Converta sem parar')).rejects.toMatchObject({
      status: HttpStatus.BAD_GATEWAY,
    });
    expect(create).toHaveBeenCalledTimes(5);
  });

  it('responde 503 quando não há chave da API configurada', async () => {
    const semChave = await build(null);

    await expect(semChave.ask('Quanto dá 1 dólar em reais?')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
