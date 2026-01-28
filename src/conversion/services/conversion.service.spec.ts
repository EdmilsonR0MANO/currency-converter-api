import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { ConversionService } from './conversion.service';
import { ExchangeRateService } from './exchange-rate.service';

describe('ConversionService', () => {
  let service: ConversionService;
  let exchangeRateService: ExchangeRateService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };

  const mockExchangeData = {
    code: 'USD',
    codein: 'BRL',
    name: 'Dólar Americano/Real Brasileiro',
    high: '5.00',
    low: '4.90',
    varBid: '0.05',
    pctChange: '1.0',
    bid: '4.95',
    ask: '4.96',
    timestamp: '1705320000',
    create_date: '2024-01-15 10:00:00',
  };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversionService,
        {
          provide: ExchangeRateService,
          useValue: {
            getExchangeRate: jest.fn().mockResolvedValue(mockExchangeData),
            getSupportedCurrencies: jest.fn().mockReturnValue(['USD', 'BRL', 'EUR']),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('120'),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<ConversionService>(ConversionService);
    exchangeRateService = module.get<ExchangeRateService>(ExchangeRateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('convert', () => {
    it('should convert currency successfully without cache', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.convert({
        from: 'USD',
        to: 'BRL',
        amount: 100,
      });

      expect(result.from).toBe('USD');
      expect(result.to).toBe('BRL');
      expect(result.originalAmount).toBe(100);
      expect(result.exchangeRate).toBe(4.95);
      expect(result.convertedAmount).toBe(495);
      expect(result.fromCache).toBe(false);
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should return cached data when available', async () => {
      cacheManager.get.mockResolvedValue({
        data: mockExchangeData,
        cachedAt: new Date().toISOString(),
      });

      const result = await service.convert({
        from: 'USD',
        to: 'BRL',
        amount: 100,
      });

      expect(result.fromCache).toBe(true);
      expect(result.cacheTtl).toBe(120);
      expect(exchangeRateService.getExchangeRate).not.toHaveBeenCalled();
    });

    it('should calculate conversion correctly', async () => {
      cacheManager.get.mockResolvedValue(null);

      const result = await service.convert({
        from: 'USD',
        to: 'BRL',
        amount: 50,
      });

      expect(result.convertedAmount).toBe(247.5); // 50 * 4.95
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return list of supported currencies', () => {
      const currencies = service.getSupportedCurrencies();
      expect(currencies).toContain('USD');
      expect(currencies).toContain('BRL');
      expect(currencies).toContain('EUR');
    });
  });
});
