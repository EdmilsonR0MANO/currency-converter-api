import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class AskAssistantDto {
  @ApiProperty({
    description: 'Pergunta em linguagem natural sobre conversão de moedas',
    example: 'Quanto dá 250 dólares em reais?',
    minLength: 3,
    maxLength: 500,
  })
  @IsString({ message: 'A pergunta deve ser um texto' })
  @IsNotEmpty({ message: 'A pergunta é obrigatória' })
  @Length(3, 500, { message: 'A pergunta deve ter entre 3 e 500 caracteres' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  question: string;
}
