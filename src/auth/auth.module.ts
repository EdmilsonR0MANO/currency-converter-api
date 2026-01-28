import { Module, Global } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';

@Global()
@Module({
  providers: [ApiKeyGuard],
  exports: [ApiKeyGuard],
})
export class AuthModule {}
