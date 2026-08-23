import { InputType, Field, Int } from '@nestjs/graphql';

/**
 * Input для добавления категорий
 */
@InputType()
export class AddAvailableCategoriesInput {
  @Field(() => [Int], { description: 'ID категорий для добавления (целые категории)' })
  categoryIds!: number[];
}
