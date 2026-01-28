# 🏗️ Arquitetura do Projeto

## Visão Geral

Este projeto segue a arquitetura modular do NestJS, com separação clara de responsabilidades.

## Estrutura de Diretórios

```
src/
├── main.ts                      # Bootstrap da aplicação
├── app.module.ts                # Módulo raiz
│
├── auth/                        # Módulo de Autenticação
│   ├── auth.module.ts
│   └── guards/
│       └── api-key.guard.ts     # Guard de validação da API Key
│
├── conversion/                  # Módulo de Conversão (domínio principal)
│   ├── conversion.module.ts
│   ├── conversion.controller.ts # Endpoints REST
│   ├── dto/
│   │   ├── convert-currency.dto.ts      # Validação de entrada
│   │   └── conversion-response.dto.ts   # Formato de resposta
│   └── services/
│       ├── conversion.service.ts        # Lógica de negócio + cache
│       └── exchange-rate.service.ts     # Integração com API externa
│
└── health/                      # Módulo de Health Check
    ├── health.module.ts
    └── health.controller.ts
```

## Fluxo de Dados

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│   Cliente   │────▶│  API Guard   │────▶│   Controller   │────▶│    Service      │
│  (Request)  │     │ (API Key)    │     │  (Validação)   │     │ (Cache/Lógica)  │
└─────────────┘     └──────────────┘     └────────────────┘     └────────┬────────┘
                                                                         │
                    ┌──────────────┐     ┌────────────────┐              │
                    │   Response   │◀────│  AwesomeAPI    │◀─────────────┘
                    │   (JSON)     │     │  (Cotações)    │   (se não em cache)
                    └──────────────┘     └────────────────┘
```

## Padrões Utilizados

### 1. Injeção de Dependências
Todos os serviços são injetados via constructor, facilitando testes e manutenção.

```typescript
constructor(
  private readonly exchangeRateService: ExchangeRateService,
  @Inject(CACHE_MANAGER) private cacheManager: Cache,
) {}
```

### 2. DTOs com Validação
Uso de `class-validator` para validação declarativa dos dados de entrada.

```typescript
@IsString()
@Length(3, 3)
@Transform(({ value }) => value?.toUpperCase())
from: string;
```

### 3. Guards para Autenticação
Middleware de segurança que intercepta requisições antes do controller.

### 4. Tratamento de Erros Centralizado
Exceções HTTP específicas para cada cenário de erro.

## Tecnologias

| Tecnologia | Uso |
|------------|-----|
| NestJS | Framework principal |
| TypeScript | Linguagem |
| class-validator | Validação de DTOs |
| @nestjs/axios | Cliente HTTP |
| cache-manager | Sistema de cache |
| Swagger | Documentação da API |
| Jest | Testes |
