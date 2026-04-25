import { InputType, Field } from '@nestjs/graphql';
import { CategoryTypeInput } from './category-type-input.dto';

/**
 * Input для удаления типов товаров
 */
@InputType()
export class RemoveAvailableCategoryTypesInput {
  @Field(() => [CategoryTypeInput], { description: 'Типы товаров для удаления' })
  categoryTypes!: CategoryTypeInput[];
}
