import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversionModule } from '../conversion/conversion.module';
import { AssistantController } from './assistant.controller';
import { ANTHROPIC_CLIENT, AssistantService } from './assistant.service';

@Module({
  imports: [ConversionModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    {
      // Sem ANTHROPIC_API_KEY o resto da API continua funcionando; só o assistente responde 503
      provide: ANTHROPIC_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Anthropic | null =>
        config.get<string>('ANTHROPIC_API_KEY') ? new Anthropic() : null,
    },
  ],
})
export class AssistantModule {}
