import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO для фильтрации долгов
 */
@InputType('DebtFilter')
export class DebtFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по имени пользователя' })
  @IsOptional()
  @IsString()
  username?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по хешу проекта' })
  @IsOptional()
  @IsString()
  projectHash?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по статусу долга' })
  @IsOptional()
  @IsString()
  status?: string;
}
