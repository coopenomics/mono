import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO для фильтрации расходов
 */
@InputType('ExpenseFilter')
export class ExpenseFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по имени пользователя' })
  @IsOptional()
  @IsString()
  username?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по хешу проекта' })
  @IsOptional()
  @IsString()
  projectHash?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по статусу расхода' })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по ID фонда' })
  @IsOptional()
  @IsString()
  fundId?: string;
}
