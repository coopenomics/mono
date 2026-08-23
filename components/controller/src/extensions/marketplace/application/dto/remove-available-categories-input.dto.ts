import { InputType, Field, Int } from '@nestjs/graphql';

/**
 * Input для удаления категорий
 */
@InputType()
export class RemoveAvailableCategoriesInput {
  @Field(() => [Int], { description: 'ID категорий для удаления' })
  categoryIds!: number[];
}
