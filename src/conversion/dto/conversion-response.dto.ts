import { ApiProperty } from '@nestjs/swagger';

export class ConversionResponseDto {
  @ApiProperty({
    description: 'Moeda de origem',
    example: 'USD',
  })
  from: string;

  @ApiProperty({
    description: 'Moeda de destino',
    example: 'BRL',
  })
  to: string;

  @ApiProperty({
    description: 'Valor original',
    example: 100,
  })
  originalAmount: number;

  @ApiProperty({
    description: 'Valor convertido',
    example: 498.5,
  })
  convertedAmount: number;

  @ApiProperty({
    description: 'Taxa de câmbio utilizada',
    example: 4.985,
  })
  exchangeRate: number;

  @ApiProperty({
    description: 'Indica se os dados foram obtidos do cache',
    example: false,
  })
  fromCache: boolean;

  @ApiProperty({
    description: 'Data e hora da cotação',
    example: '2024-01-15T10:30:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Tempo de vida do cache em segundos (quando aplicável)',
    example: 120,
    required: false,
  })
  cacheTtl?: number;
}
