import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Currency Converter API (e2e)', () => {
  let app: INestApplication;
  // O teste define a chave que o guard vai exigir. Antes ele dependia do .env de quem rodava:
  // num clone limpo o guard usava a chave padrão e 4 testes falhavam com 401.
  const apiKey = 'e2e-test-api-key';
  process.env.API_KEY = apiKey;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/api/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('version');
        });
    });
  });

  describe('Authentication', () => {
    it('should reject requests without API Key', () => {
      return request(app.getHttpServer())
        .get('/api/conversion/convert?from=USD&to=BRL&amount=100')
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('API Key');
        });
    });

    it('should reject requests with invalid API Key', () => {
      return request(app.getHttpServer())
        .get('/api/conversion/convert?from=USD&to=BRL&amount=100')
        .set('x-api-key', 'invalid-key')
        .expect(401);
    });
  });

  describe('Conversion Validation', () => {
    it('should reject negative amounts', () => {
      return request(app.getHttpServer())
        .post('/api/conversion/convert')
        .set('x-api-key', apiKey)
        .send({ from: 'USD', to: 'BRL', amount: -100 })
        .expect(400)
        .expect((res) => {
          // message pode ser array ou string
          const messages = Array.isArray(res.body.message)
            ? res.body.message.join(' ')
            : res.body.message;
          expect(messages).toContain('positivo');
        });
    });

    it('should reject invalid currency codes', () => {
      return request(app.getHttpServer())
        .post('/api/conversion/convert')
        .set('x-api-key', apiKey)
        .send({ from: 'INVALID', to: 'BRL', amount: 100 })
        .expect(400);
    });

    it('should reject same currency conversion', () => {
      return request(app.getHttpServer())
        .post('/api/conversion/convert')
        .set('x-api-key', apiKey)
        .send({ from: 'USD', to: 'USD', amount: 100 })
        .expect(400);
    });
  });

  describe('Currencies List', () => {
    it('should return list of supported currencies', () => {
      return request(app.getHttpServer())
        .get('/api/conversion/currencies')
        .set('x-api-key', apiKey)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('currencies');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.currencies)).toBe(true);
          expect(res.body.currencies).toContain('USD');
          expect(res.body.currencies).toContain('BRL');
        });
    });
  });
});
