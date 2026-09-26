import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const config = new DocumentBuilder()
    .setTitle('API de Conversão Monetária')
    .setDescription(
      `
      API para conversão de moedas em tempo real.
      
      ## Autenticação
      Esta API utiliza autenticação via API Key. Inclua o header \`x-api-key\` em todas as requisições.
      
      ## Funcionalidades
      - Conversão entre diversas moedas
      - Cotações em tempo real via AwesomeAPI
      - Cache de 2 minutos para otimização
      - Indicação de origem dos dados (API ou Cache)
      - Assistente em linguagem natural (Claude com function calling)
    `,
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'API Key para autenticação',
      },
      'api-key',
    )
    .addTag('conversion', 'Endpoints de conversão monetária')
    .addTag('assistant', 'Perguntas em linguagem natural (IA)')
    .addTag('health', 'Health check da aplicação')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Aplicação rodando em: http://localhost:${port}`);
  console.log(`📚 Documentação Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
