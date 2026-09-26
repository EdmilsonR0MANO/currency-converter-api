import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('API_KEY') || 'default-api-key-change-me';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'API Key não fornecida',
        error: 'Inclua o header "x-api-key" na requisição',
      });
    }

    if (apiKey !== this.apiKey) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'API Key inválida',
        error: 'A API Key fornecida não é válida',
      });
    }

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // Tenta obter do header x-api-key
    const headerKey = request.headers['x-api-key'];
    if (headerKey) {
      return Array.isArray(headerKey) ? headerKey[0] : headerKey;
    }

    // Alternativa: tenta obter do query parameter api_key
    const queryKey = request.query['api_key'];
    if (queryKey && typeof queryKey === 'string') {
      return queryKey;
    }

    return undefined;
  }
}
