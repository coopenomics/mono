import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';

/**
 * Input для получения обязательных атрибутов
 */
@InputType()
export class GetRequiredAttributesInput {
  @Field(() => Int, { description: 'ID категории' })
  @IsNumber()
  categoryId!: number;

  @Field(() => Int, { description: 'ID типа товара' })
  @IsNumber()
  typeId!: number;
}
