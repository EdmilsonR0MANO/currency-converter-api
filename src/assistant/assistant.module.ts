import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversionModule } from '../conversion/conversion.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ANTHROPIC_CLIENT, AnthropicProvider } from './providers/anthropic.provider';
import { GEMINI_CLIENT, GeminiProvider } from './providers/gemini.provider';

@Module({
  imports: [ConversionModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AnthropicProvider,
    GeminiProvider,
    // Sem a chave de um provedor, o cliente dele fica nulo: o resto da API continua funcionando
    {
      provide: ANTHROPIC_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Anthropic | null =>
        config.get<string>('ANTHROPIC_API_KEY') ? new Anthropic() : null,
    },
    {
      provide: GEMINI_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): GoogleGenAI | null => {
        const apiKey = config.get<string>('GEMINI_API_KEY');
        return apiKey ? new GoogleGenAI({ apiKey }) : null;
      },
    },
  ],
})
export class AssistantModule {}
