import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, catchError, timeout } from 'rxjs';
import { AxiosError } from 'axios';

export interface ExchangeRateData {
  code: string;
  codein: string;
  name: string;
  high: string;
  low: string;
  varBid: string;
  pctChange: string;
  bid: string;
  ask: string;
  timestamp: string;
  create_date: string;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly baseUrl: string;

  private readonly supportedCurrencies = new Set([
    'USD',
    'BRL',
    'EUR',
    'GBP',
    'ARS',
    'CAD',
    'AUD',
    'JPY',
    'CNY',
    'BTC',
    'ETH',
    'LTC',
    'XRP',
    'CHF',
    'MXN',
    'CLP',
    'COP',
    'PEN',
    'UYU',
    'PYG',
    'BOB',
    'VEF',
    'HKD',
    'SGD',
    'INR',
    'ILS',
    'TRY',
    'RUB',
    'PLN',
    'ZAR',
    'KRW',
    'NZD',
    'SEK',
    'NOK',
    'DKK',
    'CZK',
    'HUF',
    'RON',
    'BGN',
    'HRK',
    'THB',
    'MYR',
    'PHP',
    'IDR',
    'TWD',
    'SAR',
    'AED',
    'EGP',
    'NGN',
    'KES',
  ]);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('EXCHANGE_API_URL') ||
      'https://economia.awesomeapi.com.br/json/last';
  }

  /**
   * Valida se as moedas são suportadas
   */
  validateCurrencies(from: string, to: string): void {
    const errors: string[] = [];

    if (!this.supportedCurrencies.has(from)) {
      errors.push(`Moeda de origem '${from}' não é suportada`);
    }

    if (!this.supportedCurrencies.has(to)) {
      errors.push(`Moeda de destino '${to}' não é suportada`);
    }

    if (from === to) {
      errors.push('A moeda de origem e destino não podem ser iguais');
    }

    if (errors.length > 0) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Erro de validação das moedas',
          errors,
          supportedCurrencies: Array.from(this.supportedCurrencies).sort(),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Obtém a taxa de câmbio da API externa
   */
  async getExchangeRate(from: string, to: string): Promise<ExchangeRateData> {
    this.validateCurrencies(from, to);

    const pair = `${from}-${to}`;
    const url = `${this.baseUrl}/${pair}`;

    this.logger.log(`Buscando cotação para ${pair} na API externa`);

    try {
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(
          timeout(8000), // Timeout de 8 segundos
          catchError((error: AxiosError) => {
            this.logger.error(`Erro ao buscar cotação: ${error.message}`);
            throw this.handleApiError(error, pair);
          }),
        ),
      );

      const key = `${from}${to}`;
      const data = response.data[key];

      if (!data) {
        throw new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: `Cotação não encontrada para o par ${pair}`,
            suggestion: 'Verifique se as moedas informadas são válidas',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      this.logger.log(`Cotação obtida com sucesso: ${pair} = ${data.bid}`);
      return data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Erro inesperado: ${error}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Serviço de cotações temporariamente indisponível',
          error: 'Por favor, tente novamente em alguns instantes',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Trata erros da API externa
   */
  private handleApiError(error: AxiosError, pair: string): HttpException {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return new HttpException(
        {
          statusCode: HttpStatus.GATEWAY_TIMEOUT,
          message: 'Timeout ao consultar API de cotações',
          error: 'O serviço de cotações demorou muito para responder',
        },
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }

    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        return new HttpException(
          {
            statusCode: HttpStatus.NOT_FOUND,
            message: `Par de moedas ${pair} não encontrado`,
            suggestion: 'Verifique se as moedas informadas existem',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      if (status === 429) {
        return new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Limite de requisições excedido na API de cotações',
            error: 'Aguarde alguns segundos e tente novamente',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'API de cotações indisponível',
          error: 'Não foi possível conectar ao serviço de cotações',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: 'Erro ao comunicar com API de cotações',
        error: error.message,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Retorna lista de moedas suportadas
   */
  getSupportedCurrencies(): string[] {
    return Array.from(this.supportedCurrencies).sort();
  }
}
