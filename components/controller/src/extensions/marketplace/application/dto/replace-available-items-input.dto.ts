import { InputType, Field, Int } from '@nestjs/graphql';
import { CategoryTypeInput } from './category-type-input.dto';

/**
 * Input для замены всех доступных элементов
 */
@InputType()
export class ReplaceAvailableItemsInput {
  @Field(() => [Int], { description: 'ID категорий (целые категории)', defaultValue: [] })
  categoryIds: number[] = [];

  @Field(() => [CategoryTypeInput], { description: 'Типы товаров', defaultValue: [] })
  categoryTypes: CategoryTypeInput[] = [];
}
