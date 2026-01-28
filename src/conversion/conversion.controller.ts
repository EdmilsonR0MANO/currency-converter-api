import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ConversionService } from './services/conversion.service';
import { ConvertCurrencyDto, ConversionResponseDto } from './dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@ApiTags('conversion')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('api/conversion')
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  @Get('convert')
  @ApiOperation({
    summary: 'Converter moeda via GET',
    description: 'Converte um valor de uma moeda para outra usando parâmetros de query',
  })
  @ApiQuery({
    name: 'from',
    description: 'Código da moeda de origem (ex: USD)',
    example: 'USD',
  })
  @ApiQuery({
    name: 'to',
    description: 'Código da moeda de destino (ex: BRL)',
    example: 'BRL',
  })
  @ApiQuery({
    name: 'amount',
    description: 'Valor a ser convertido',
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: 'Conversão realizada com sucesso',
    type: ConversionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dados de entrada inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'API Key inválida ou ausente',
  })
  @ApiResponse({
    status: 404,
    description: 'Par de moedas não encontrado',
  })
  @ApiResponse({
    status: 503,
    description: 'Serviço de cotações indisponível',
  })
  async convertGet(@Query() query: ConvertCurrencyDto): Promise<ConversionResponseDto> {
    return this.conversionService.convert(query);
  }

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Converter moeda via POST',
    description: 'Converte um valor de uma moeda para outra usando corpo da requisição',
  })
  @ApiBody({
    type: ConvertCurrencyDto,
    description: 'Dados para conversão',
    examples: {
      'USD para BRL': {
        value: {
          from: 'USD',
          to: 'BRL',
          amount: 100,
        },
      },
      'EUR para USD': {
        value: {
          from: 'EUR',
          to: 'USD',
          amount: 50,
        },
      },
      'BTC para BRL': {
        value: {
          from: 'BTC',
          to: 'BRL',
          amount: 0.5,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Conversão realizada com sucesso',
    type: ConversionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Dados de entrada inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'API Key inválida ou ausente',
  })
  @ApiResponse({
    status: 404,
    description: 'Par de moedas não encontrado',
  })
  @ApiResponse({
    status: 503,
    description: 'Serviço de cotações indisponível',
  })
  async convertPost(@Body() body: ConvertCurrencyDto): Promise<ConversionResponseDto> {
    return this.conversionService.convert(body);
  }

  @Get('currencies')
  @ApiOperation({
    summary: 'Listar moedas suportadas',
    description: 'Retorna a lista de todas as moedas suportadas pela API',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de moedas suportadas',
    schema: {
      type: 'object',
      properties: {
        currencies: {
          type: 'array',
          items: { type: 'string' },
          example: ['AED', 'ARS', 'AUD', 'BRL', 'BTC', 'CAD', 'EUR', 'GBP', 'USD'],
        },
        total: {
          type: 'number',
          example: 50,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'API Key inválida ou ausente',
  })
  getSupportedCurrencies() {
    const currencies = this.conversionService.getSupportedCurrencies();
    return {
      currencies,
      total: currencies.length,
    };
  }
}
