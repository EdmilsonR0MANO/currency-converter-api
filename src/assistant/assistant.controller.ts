import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AssistantService } from './assistant.service';
import { AskAssistantDto, AssistantResponseDto } from './dto';

@ApiTags('assistant')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('api/assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Perguntar em linguagem natural',
    description:
      'O modelo interpreta a pergunta e chama a conversão desta API por function calling. ' +
      'Os números vêm do serviço de conversão, não do modelo.',
  })
  @ApiBody({
    type: AskAssistantDto,
    examples: {
      'Dólar para real': { value: { question: 'Quanto dá 250 dólares em reais?' } },
      'Duas conversões': { value: { question: 'Quanto são 100 euros em dólar e em libra?' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Resposta do assistente', type: AssistantResponseDto })
  @ApiResponse({ status: 400, description: 'Pergunta vazia ou com mais de 500 caracteres' })
  @ApiResponse({ status: 401, description: 'API Key inválida ou ausente' })
  @ApiResponse({ status: 429, description: 'Limite de uso do modelo atingido' })
  @ApiResponse({ status: 502, description: 'Falha ao consultar o modelo' })
  @ApiResponse({ status: 503, description: 'Assistente sem credencial configurada' })
  async ask(@Body() body: AskAssistantDto): Promise<AssistantResponseDto> {
    return this.assistantService.ask(body.question);
  }
}
