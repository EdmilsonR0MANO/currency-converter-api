import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { ExchangeRateService, ExchangeRateData } from './exchange-rate.service';
import { ConvertCurrencyDto, ConversionResponseDto } from '../dto';

interface CachedExchangeRate {
  data: ExchangeRateData;
  cachedAt: string;
}

@Injectable()
export class ConversionService {
  private readonly logger = new Logger(ConversionService.name);
  private readonly cacheTtl: number;

  constructor(
    private readonly exchangeRateService: ExchangeRateService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.cacheTtl = parseInt(this.configService.get<string>('CACHE_TTL') || '120');
  }

  /**
   * Realiza a conversão monetária
   */
  async convert(dto: ConvertCurrencyDto): Promise<ConversionResponseDto> {
    const { from, to, amount } = dto;
    const cacheKey = this.getCacheKey(from, to);

    const cachedData = await this.getFromCache(cacheKey);

    let exchangeData: ExchangeRateData;
    let fromCache = false;

    if (cachedData) {
      this.logger.log(`Dados obtidos do cache para ${from}-${to}`);
      exchangeData = cachedData.data;
      fromCache = true;
    } else {
      exchangeData = await this.exchangeRateService.getExchangeRate(from, to);

      await this.saveToCache(cacheKey, exchangeData);
    }

    const exchangeRate = parseFloat(exchangeData.bid);
    const convertedAmount = this.calculateConversion(amount, exchangeRate);

    return {
      from,
      to,
      originalAmount: amount,
      convertedAmount,
      exchangeRate,
      fromCache,
      timestamp: new Date().toISOString(),
      cacheTtl: fromCache ? this.cacheTtl : undefined,
    };
  }

  private getCacheKey(from: string, to: string): string {
    return `exchange_rate:${from}:${to}`;
  }

  private async getFromCache(key: string): Promise<CachedExchangeRate | null> {
    try {
      const cached = await this.cacheManager.get<CachedExchangeRate>(key);
      return cached || null;
    } catch (error) {
      this.logger.warn(`Erro ao acessar cache: ${error}`);
      return null;
    }
  }

  private async saveToCache(key: string, data: ExchangeRateData): Promise<void> {
    try {
      const cacheData: CachedExchangeRate = {
        data,
        cachedAt: new Date().toISOString(),
      };

      await this.cacheManager.set(key, cacheData, this.cacheTtl * 1000);
      this.logger.log(`Dados salvos no cache com TTL de ${this.cacheTtl}s`);
    } catch (error) {
      this.logger.warn(`Erro ao salvar no cache: ${error}`);
    }
  }

  private calculateConversion(amount: number, rate: number): number {
    const result = amount * rate;
    return Math.round(result * 100) / 100;
  }

  getSupportedCurrencies(): string[] {
    return this.exchangeRateService.getSupportedCurrencies();
  }
}
