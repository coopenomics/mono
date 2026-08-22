import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';

/**
 * Input для валидации значений атрибута
 */
@InputType()
export class ValidateAttributeValuesInput {
  @Field(() => Int, { description: 'ID атрибута' })
  @IsNumber()
  attributeId!: number;

  @Field(() => [String], { description: 'Значения для валидации' })
  values!: string[];
}
