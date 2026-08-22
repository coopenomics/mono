import { InputType, Field, Int } from '@nestjs/graphql';

/**
 * Input для типа категории товара
 */
@InputType()
export class CategoryTypeInput {
  @Field(() => Int, { description: 'ID категории' })
  categoryId!: number;

  @Field(() => Int, { description: 'ID типа товара' })
  typeId!: number;
}
