import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';

/**
 * Input для публикации заявки
 */
@InputType()
export class PublishRequestInput {
  @Field(() => Int, { description: 'ID заявки для публикации' })
  @IsNumber()
  id!: number;
}
