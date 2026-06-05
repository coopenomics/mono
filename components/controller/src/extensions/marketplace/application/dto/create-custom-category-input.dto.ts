import { InputType, Field } from '@nestjs/graphql';

/**
 * Input для добавления собственной категории кооператива (Эпик 16).
 */
@InputType()
export class CreateCustomCategoryInput {
  @Field(() => String, { description: 'Название новой категории' })
  displayName!: string;
}
