import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';

/**
 * Input для получения дерева категорий
 */
@InputType()
export class GetCategoryTreeInput {
  @Field(() => Int, { description: 'ID корневой категории', nullable: true })
  @IsOptional()
  @IsNumber()
  rootCategoryId?: number;

  @Field({ description: 'Включать только доступные категории', nullable: true, defaultValue: false })
  @IsOptional()
  onlyAvailable?: boolean;

  @Field({ description: 'Включать типы товаров', nullable: true, defaultValue: true })
  @IsOptional()
  includeTypes?: boolean;

  @Field(() => Int, { description: 'Максимальная глубина дерева', nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxDepth?: number;
}
