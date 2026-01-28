import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let configService: ConfigService;
  const validApiKey = 'test-api-key';

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue(validApiKey),
    } as unknown as ConfigService;

    guard = new ApiKeyGuard(configService);
  });

  const createMockContext = (
    headers: Record<string, string>,
    query: Record<string, string> = {},
  ) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          query,
        }),
      }),
    } as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request with valid API Key in header', () => {
    const context = createMockContext({ 'x-api-key': validApiKey });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow request with valid API Key in query', () => {
    const context = createMockContext({}, { api_key: validApiKey });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when API Key is missing', () => {
    const context = createMockContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('API Key não fornecida');
  });

  it('should throw UnauthorizedException when API Key is invalid', () => {
    const context = createMockContext({ 'x-api-key': 'invalid-key' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context)).toThrow('API Key inválida');
  });
});
