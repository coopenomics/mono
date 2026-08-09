import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';

/**
 * Input для получения категории по ID
 */
@InputType()
export class GetCategoryByIdInput {
  @Field(() => Int, { description: 'ID категории' })
  @IsNumber()
  categoryId!: number;
}
