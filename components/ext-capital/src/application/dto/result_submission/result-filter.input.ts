import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO для фильтрации результатов
 */
@InputType('ResultFilter')
export class ResultFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по имени пользователя' })
  @IsOptional()
  @IsString()
  username?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по хешу проекта' })
  @IsOptional()
  @IsString()
  projectHash?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по статусу результата' })
  @IsOptional()
  @IsString()
  status?: string;
}
