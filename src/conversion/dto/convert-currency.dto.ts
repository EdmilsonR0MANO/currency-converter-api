import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, Length, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class ConvertCurrencyDto {
  @ApiProperty({
    description: 'Código da moeda de origem (ISO 4217)',
    example: 'USD',
    minLength: 3,
    maxLength: 3,
  })
  @IsString({ message: 'A moeda de origem deve ser uma string' })
  @IsNotEmpty({ message: 'A moeda de origem é obrigatória' })
  @Length(3, 3, { message: 'O código da moeda deve ter exatamente 3 caracteres' })
  @Transform(({ value }) => value?.toUpperCase()?.trim())
  from: string;

  @ApiProperty({
    description: 'Código da moeda de destino (ISO 4217)',
    example: 'BRL',
    minLength: 3,
    maxLength: 3,
  })
  @IsString({ message: 'A moeda de destino deve ser uma string' })
  @IsNotEmpty({ message: 'A moeda de destino é obrigatória' })
  @Length(3, 3, { message: 'O código da moeda deve ter exatamente 3 caracteres' })
  @Transform(({ value }) => value?.toUpperCase()?.trim())
  to: string;

  @ApiProperty({
    description: 'Valor a ser convertido (deve ser positivo)',
    example: 100,
    minimum: 0.01,
  })
  @IsNumber({}, { message: 'O valor deve ser um número' })
  @IsPositive({ message: 'O valor deve ser positivo' })
  @Transform(({ value }) => parseFloat(value))
  amount: number;
}
