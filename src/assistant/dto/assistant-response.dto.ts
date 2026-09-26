import { ApiProperty } from '@nestjs/swagger';
import { ConversionResponseDto } from '../../conversion/dto';

export class AssistantResponseDto {
  @ApiProperty({
    description: 'Resposta redigida pelo modelo a partir das conversões abaixo',
    example: '250 dólares dão R$ 1.346,25, com a cotação de 5,385.',
  })
  answer: string;

  @ApiProperty({
    description:
      'Conversões feitas pelo serviço desta API para montar a resposta (fonte dos números)',
    type: [ConversionResponseDto],
  })
  conversions: ConversionResponseDto[];

  @ApiProperty({ description: 'Modelo que respondeu', example: 'claude-opus-5' })
  model: string;
}
