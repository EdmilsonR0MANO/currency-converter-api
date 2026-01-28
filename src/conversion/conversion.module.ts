import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConversionController } from './conversion.controller';
import { ConversionService } from './services/conversion.service';
import { ExchangeRateService } from './services/exchange-rate.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [ConversionController],
  providers: [ConversionService, ExchangeRateService],
  exports: [ConversionService],
})
export class ConversionModule {}
