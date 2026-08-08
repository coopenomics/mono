import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';

/**
 * Input для поиска атрибутов
 */
@InputType()
export class SearchAttributesInput {
  @Field({ description: 'Текст для поиска' })
  @IsString()
  searchTerm!: string;

  @Field(() => Int, { description: 'ID категории для фильтрации', nullable: true })
  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @Field(() => Int, { description: 'ID типа товара для фильтрации', nullable: true })
  @IsOptional()
  @IsNumber()
  typeId?: number;

  @Field({ description: 'Только обязательные', nullable: true, defaultValue: false })
  @IsOptional()
  onlyRequired?: boolean;

  @Field({ description: 'Только аспектные', nullable: true, defaultValue: false })
  @IsOptional()
  onlyAspect?: boolean;

  @Field({ description: 'Только со словарями', nullable: true, defaultValue: false })
  @IsOptional()
  onlyWithDictionary?: boolean;

  @Field(() => Int, { description: 'Максимальное количество результатов', nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
