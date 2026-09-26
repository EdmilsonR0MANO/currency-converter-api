import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { ConversionModule } from './conversion/conversion.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    // Configuração de variáveis de ambiente
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Configuração de cache em memória
    CacheModule.register({
      isGlobal: true,
      ttl: parseInt(process.env.CACHE_TTL || '120') * 1000, // Convertendo para milissegundos
      max: 100, // Máximo de itens no cache
    }),

    // Configuração do módulo HTTP para requisições externas
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),

    // Módulos da aplicação
    AuthModule,
    ConversionModule,
    HealthModule,
    AssistantModule,
  ],
})
export class AppModule {}
