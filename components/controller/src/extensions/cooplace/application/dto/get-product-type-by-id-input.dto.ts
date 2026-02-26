import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';

/**
 * Input для получения типа товара по ID
 */
@InputType()
export class GetProductTypeByIdInput {
  @Field(() => Int, { description: 'ID типа товара' })
  @IsNumber()
  typeId!: number;
}
