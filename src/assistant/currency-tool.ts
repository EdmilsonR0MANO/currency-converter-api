import { HttpException } from '@nestjs/common';
import { ConversionResponseDto } from '../conversion/dto';
import { ConversionService } from '../conversion/services/conversion.service';

// Regras e ferramenta compartilhadas pelos provedores (Claude e Gemini): só o adaptador muda.

export const SYSTEM_PROMPT = [
  'Você é o assistente da API de conversão de moedas.',
  'Para qualquer valor em outra moeda, chame a ferramenta convert_currency: nunca calcule câmbio de cabeça nem invente cotação.',
  'Responda em português do Brasil, em até duas frases, com o valor convertido e a cotação usada.',
  'Se a pergunta não for sobre conversão de moedas, diga que só ajuda com conversões.',
].join(' ');

// Cada volta é uma ida ao modelo. Uma pergunta normal usa 2 (pede a conversão, depois responde);
// o limite evita laço infinito se o modelo insistir em chamar a ferramenta.
export const MAX_ROUNDS = 5;

export const TOOL_NAME = 'convert_currency';

export const TOOL_DESCRIPTION =
  'Converte um valor entre duas moedas com a cotação atual (AwesomeAPI, com cache de 2 minutos). ' +
  'Use códigos ISO 4217: dólar americano = USD, real = BRL, euro = EUR, libra = GBP, bitcoin = BTC.';

export const REFUSAL_ANSWER =
  'Não consigo ajudar com esse pedido. Posso converter valores entre moedas.';

export function toolInputSchema(currencies: string[]) {
  return {
    type: 'object' as const,
    properties: {
      from: { type: 'string', enum: currencies, description: 'Moeda de origem' },
      to: { type: 'string', enum: currencies, description: 'Moeda de destino' },
      amount: { type: 'number', description: 'Valor na moeda de origem, maior que zero' },
    },
    required: ['from', 'to', 'amount'],
    additionalProperties: false,
  };
}

export interface ToolOutcome {
  ok: boolean;
  /** JSON com o resultado (ok) ou a mensagem de erro para o modelo explicar ao usuário */
  content: string;
  conversion?: ConversionResponseDto;
}

/** Executa convert_currency. A entrada vem do modelo, então é validada de novo aqui. */
export async function runConvertCurrency(
  conversionService: ConversionService,
  input: unknown,
): Promise<ToolOutcome> {
  const args = (input ?? {}) as { from?: unknown; to?: unknown; amount?: unknown };
  const from = String(args.from ?? '').toUpperCase();
  const to = String(args.to ?? '').toUpperCase();
  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, content: 'O valor a converter deve ser um número maior que zero' };
  }
  try {
    const result = await conversionService.convert({ from, to, amount });
    return {
      ok: true,
      conversion: result,
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
    return { ok: false, content: describeError(error) };
  }
}

export function describeError(error: unknown): string {
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
