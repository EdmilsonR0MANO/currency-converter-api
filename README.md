# 💱 Currency Converter API

API RESTful para conversão de moedas em tempo real, desenvolvida em **Node.js** com **NestJS**.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Tecnologias](#-tecnologias)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Execução](#-execução)
- [Documentação da API](#-documentação-da-api)
- [Exemplos de Uso](#-exemplos-de-uso)
- [Testes](#-testes)
- [Estrutura do Projeto](#-estrutura-do-projeto)

---

## ✨ Funcionalidades

### Requisitos Obrigatórios ✅

- [x] **Conversão via GET e POST** - Suporte a ambos os métodos HTTP
- [x] **Cotação em tempo real** - Integração com AwesomeAPI
- [x] **Autenticação via API Key** - Header `x-api-key` obrigatório
- [x] **Validação de entrada** - Moedas inexistentes, valores negativos, etc.
- [x] **Tratamento de erros** - API externa indisponível, timeout, rate limiting
- [x] **Código limpo** - TypeScript com ESLint e Prettier
- [x] **Documentação** - README completo + Swagger interativo

### Diferenciais Implementados ✅

- [x] **Sistema de Cache** - TTL de 2 minutos para otimização
- [x] **Indicação de origem** - Resposta indica se dados vêm do cache ou API
- [x] **Coleção Postman** - Exemplos prontos para importar e testar

---

## 🛠️ Tecnologias

| Tecnologia | Descrição |
|------------|-----------|
| **Node.js 18+** | Runtime JavaScript |
| **NestJS 10** | Framework backend |
| **TypeScript 5** | Tipagem estática |
| **class-validator** | Validação de DTOs |
| **Swagger/OpenAPI** | Documentação interativa |
| **Jest** | Framework de testes |
| **ESLint + Prettier** | Qualidade de código |

---

## 🚀 Instalação

### Pré-requisitos

- Node.js 18 ou superior
- npm ou yarn

### Passos

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/currency-converter-api.git

# Entre no diretório
cd currency-converter-api

# Instale as dependências
npm install
```

---

## ⚙️ Configuração

### 1. Criar arquivo de ambiente

```bash
cp .env.example .env
```

### 2. Gerar API Key

```bash
npm run generate:key
```

### 3. Configurar o `.env`

```env
PORT=3000
API_KEY=sua-chave-gerada-aqui
CACHE_TTL=120
EXCHANGE_API_URL=https://economia.awesomeapi.com.br/json/last
```

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `PORT` | Porta da aplicação | `3000` |
| `API_KEY` | Chave de autenticação | - |
| `CACHE_TTL` | Tempo de cache em segundos | `120` |
| `EXCHANGE_API_URL` | URL da API de cotações | AwesomeAPI |

---

## ▶️ Execução

```bash
# Desenvolvimento (hot-reload)
npm run start:dev

# Produção
npm run build
npm run start:prod
```

A API estará disponível em: `http://localhost:3000`

---

## 📖 Documentação da API

### Swagger UI

Acesse a documentação interativa em:
```
http://localhost:3000/api/docs
```

### Endpoints

| Método | Endpoint | Descrição | Auth |
|--------|----------|-----------|------|
| `GET` | `/api/health` | Health check | ❌ |
| `GET` | `/api/conversion/convert` | Converter moeda (query params) | ✅ |
| `POST` | `/api/conversion/convert` | Converter moeda (body JSON) | ✅ |
| `GET` | `/api/conversion/currencies` | Listar moedas suportadas | ✅ |

### Autenticação

Inclua o header `x-api-key` em todas as requisições protegidas:

```
x-api-key: sua-api-key-aqui
```

---

## 📝 Exemplos de Uso

### cURL

**Converter USD para BRL (POST):**
```bash
curl -X POST "http://localhost:3000/api/conversion/convert" \
  -H "Content-Type: application/json" \
  -H "x-api-key: sua-api-key-aqui" \
  -d '{"from": "USD", "to": "BRL", "amount": 100}'
```

**Converter USD para BRL (GET):**
```bash
curl -X GET "http://localhost:3000/api/conversion/convert?from=USD&to=BRL&amount=100" \
  -H "x-api-key: sua-api-key-aqui"
```

**Listar moedas suportadas:**
```bash
curl -X GET "http://localhost:3000/api/conversion/currencies" \
  -H "x-api-key: sua-api-key-aqui"
```

### Resposta de Sucesso

```json
{
  "from": "USD",
  "to": "BRL",
  "originalAmount": 100,
  "convertedAmount": 498.50,
  "exchangeRate": 4.985,
  "fromCache": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Resposta com Cache

```json
{
  "from": "USD",
  "to": "BRL",
  "originalAmount": 100,
  "convertedAmount": 498.50,
  "exchangeRate": 4.985,
  "fromCache": true,
  "timestamp": "2024-01-15T10:32:00.000Z",
  "cacheTtl": 120
}
```

### Postman

Importe a coleção disponível em `postman/Currency-Converter-API.postman_collection.json`

---

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes E2E
npm run test:e2e

# Cobertura de código
npm run test:cov

# Modo watch
npm run test:watch
```

### Cobertura de Testes

| Tipo | Quantidade | Status |
|------|------------|--------|
| Unitários | 10 | ✅ |
| E2E | 7 | ✅ |

---

## 📁 Estrutura do Projeto

```
src/
├── main.ts                 # Bootstrap da aplicação
├── app.module.ts           # Módulo raiz
├── auth/                   # Autenticação
│   └── guards/
│       └── api-key.guard.ts
├── conversion/             # Domínio principal
│   ├── dto/                # Data Transfer Objects
│   ├── services/           # Lógica de negócio
│   └── conversion.controller.ts
└── health/                 # Health check

test/                       # Testes E2E
postman/                    # Coleção Postman
docs/                       # Documentação adicional
```

Para mais detalhes, veja [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## ✅ Validações Implementadas

| Cenário | Código HTTP | Mensagem |
|---------|-------------|----------|
| API Key ausente | 401 | "API Key não fornecida" |
| API Key inválida | 401 | "API Key inválida" |
| Moeda inválida (ex: XXX) | 400 | "Moeda 'XXX' não é suportada" |
| Valor negativo | 400 | "O valor deve ser positivo" |
| Moedas iguais | 400 | "Não podem ser iguais" |
| Código com tamanho errado | 400 | "Deve ter 3 caracteres" |
| API externa indisponível | 503 | "Serviço indisponível" |
| Timeout na API externa | 504 | "Timeout ao consultar" |

---

## 🪙 Moedas Suportadas

A API suporta mais de 50 moedas, incluindo:

**Moedas tradicionais:** USD, EUR, GBP, BRL, JPY, CNY, CAD, AUD, CHF, MXN, ARS, CLP, COP...

**Criptomoedas:** BTC, ETH, LTC, XRP

Consulte a lista completa via endpoint `/api/conversion/currencies`

---

## 📜 Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run start` | Inicia a aplicação |
| `npm run start:dev` | Modo desenvolvimento (hot-reload) |
| `npm run start:prod` | Modo produção |
| `npm run build` | Compila o projeto |
| `npm run lint` | Verifica código com ESLint |
| `npm run format` | Formata código com Prettier |
| `npm run test` | Executa testes unitários |
| `npm run test:e2e` | Executa testes E2E |
| `npm run test:cov` | Relatório de cobertura |
| `npm run generate:key` | Gera nova API Key |

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👤 Autor

Desenvolvido para o desafio técnico Node.JS - Conversor Monetário.
