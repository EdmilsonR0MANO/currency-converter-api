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
- [Assistente em linguagem natural (IA)](#-assistente-em-linguagem-natural-ia)
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
- [x] **Assistente em linguagem natural (IA)** - pergunte "quanto dá 250 dólares em reais?" e o modelo (Gemini ou Claude) chama a conversão desta API por function calling ([detalhes](#-assistente-em-linguagem-natural-ia))

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

## 🤖 Assistente em linguagem natural (IA)

`POST /api/assistant/ask` recebe uma pergunta em português e responde com o valor convertido. O modelo (**Gemini** ou **Claude**, à escolha) **não faz a conta**: ele interpreta a pergunta, chama a ferramenta `convert_currency` desta API (*function calling*) e redige a resposta com o resultado que o `ConversionService` devolveu, com cotação real e o mesmo cache.

```bash
curl -X POST http://localhost:3000/api/assistant/ask \
  -H "Content-Type: application/json" \
  -H "x-api-key: sua-api-key" \
  -d '{"question": "Quanto dá 250 dólares em reais?"}'
```

```json
{
  "answer": "US$ 250,00 equivalem a R$ 1.296,65. A cotação utilizada foi de R$ 5,19 por dólar (5,1866).",
  "conversions": [
    { "from": "USD", "to": "BRL", "originalAmount": 250, "convertedAmount": 1296.65, "exchangeRate": 5.1866, "fromCache": false, "timestamp": "2026-09-26T18:31:02.000Z" }
  ],
  "model": "gemini-3.8-flash"
}
```

`conversions` traz os números que a API calculou, para conferir a resposta do modelo. Resposta real do Gemini 3.8 Flash em 26/09/2026; com "quanto são 100 euros em dólar e em libra?" ele chama a ferramenta duas vezes no mesmo turno.

### Como funciona

1. A pergunta vai para o modelo com uma ferramenta, `convert_currency(from, to, amount)`.
2. O modelo pede a conversão (uma ou várias no mesmo turno, como em "100 euros em dólar e em libra").
3. O provedor executa cada pedido no `ConversionService` (`currency-tool.ts`, compartilhado) e devolve os resultados numa única mensagem.
4. O modelo responde em até duas frases. O laço tem limite de 5 rodadas.

### Decisões

- **O modelo não calcula nem inventa cotação.** O prompt de sistema proíbe, e o número exibido sai de `conversions`.
- **`strict: true` e `enum` com as moedas suportadas**: o modelo só consegue chamar a ferramenta com os três campos e com códigos que a API conhece. "Dólar" vira `USD` pela descrição da ferramenta.
- **A entrada do modelo é validada de novo** no serviço (valor positivo, moedas válidas). Erro de conversão volta ao modelo como `tool_result` com `is_error`, e ele explica ao usuário em vez de a API devolver 500.
- **Sem `ANTHROPIC_API_KEY`**, o resto da API continua funcionando e só o assistente responde 503.
- **Erros da API do Claude** viram respostas HTTP claras: 503 para chave inválida, 429 para limite de uso e 502 para o resto.
- **Dois provedores, mesma regra**: prompt, ferramenta, validação e tratamento de erro ficam em `currency-tool.ts`; `providers/gemini.provider.ts` e `providers/anthropic.provider.ts` só adaptam o formato de cada API. `ASSISTANT_PROVIDER` escolhe; vazio usa o que tiver chave.
- **Gemini**: o turno do modelo volta inteiro na chamada seguinte, porque os modelos com raciocínio exigem de volta a assinatura do pensamento (`thoughtSignature`).
- **Claude**: esforço baixo (`ASSISTANT_EFFORT=low`), porque é uma pergunta curta com uma ferramenta, e fallback do servidor (`fallbacks: "default"`) caso o modelo recuse por política.

### Configuração

| Variável | Padrão | Para quê |
|---|---|---|
| `ASSISTANT_PROVIDER` | vazio | `gemini` ou `anthropic`. Vazio usa o primeiro com chave (Gemini, depois Claude) |
| `GEMINI_API_KEY` | vazio | Chave do Google AI Studio (tem plano gratuito) |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Modelo do Gemini |
| `ANTHROPIC_API_KEY` | vazio | Chave da API do Claude. Sem nenhuma chave, `/api/assistant/ask` responde 503 |
| `ASSISTANT_MODEL` | `claude-opus-5` | Modelo do Claude |
| `ASSISTANT_EFFORT` | `low` | `low`, `medium` ou `high`. Deixe vazio em modelos que não aceitam o parâmetro, como o `claude-haiku-4-5` |
| `ASSISTANT_FALLBACKS` | ligado | `off` desliga o fallback do servidor |

### Testes

Os testes de `src/assistant/` simulam o modelo e cobrem, para os dois provedores: conversão pedida pelo modelo, várias conversões no mesmo turno, pergunta fora do assunto, erro da conversão devolvido ao modelo, valor inválido vindo do modelo, limite de rodadas, cota esgotada, modelo indisponível e falta de chave. `assistant.service.spec.ts` cobre a escolha do provedor. Os testes E2E cobrem a proteção por API key e a validação da pergunta.

### O que deu errado no caminho

- **O modelo listado não funcionava.** `gemini-2.5-flash` aparecia em `models.list`, mas a API respondia 404 para chaves novas ("no longer available to new users"). Como o erro do provedor vira 502 genérico para o usuário, só apareceu no log do servidor. O padrão passou a ser `gemini-3.8-flash` e modelo indisponível agora responde 503 dizendo para ajustar `GEMINI_MODEL`.
- **Cota do plano gratuito.** No teste ao vivo, a quarta pergunta seguida recebeu 429 do Gemini. A API já devolvia 429 com mensagem clara; o teste passou a espaçar as perguntas.
- **Testes E2E que só passavam na minha máquina.** Num clone limpo, 4 de 7 falhavam com 401: o teste mandava uma API key e o guard, sem `.env`, esperava outra. Agora o teste define a própria chave antes de subir a aplicação.

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
├── assistant/              # Assistente em linguagem natural (function calling)
│   ├── dto/
│   ├── currency-tool.ts       # Prompt, ferramenta e execução, comuns aos provedores
│   ├── providers/             # gemini.provider.ts e anthropic.provider.ts
│   ├── assistant.service.ts   # Escolhe o provedor
│   └── assistant.controller.ts
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
