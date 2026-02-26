import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * Input для поиска категорий
 */
@InputType()
export class SearchCategoriesInput {
  @Field({ description: 'Текст для поиска по категориям и типам товаров' })
  @IsString()
  searchTerm!: string;
}
