import { InputType, Field } from '@nestjs/graphql';
import { CategoryTypeInput } from './category-type-input.dto';

/**
 * Input для добавления типов товаров
 */
@InputType()
export class AddAvailableCategoryTypesInput {
  @Field(() => [CategoryTypeInput], { description: 'Типы товаров для добавления' })
  categoryTypes!: CategoryTypeInput[];
}
