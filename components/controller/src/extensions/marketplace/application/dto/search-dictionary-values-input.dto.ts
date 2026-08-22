import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';

/**
 * Input для поиска значений словаря
 */
@InputType()
export class SearchDictionaryValuesInput {
  @Field(() => Int, { description: 'ID словаря' })
  @IsNumber()
  dictionaryId!: number;

  @Field({ description: 'Текст для поиска' })
  @IsString()
  searchTerm!: string;

  @Field(() => Int, { description: 'Максимальное количество результатов', nullable: true, defaultValue: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
