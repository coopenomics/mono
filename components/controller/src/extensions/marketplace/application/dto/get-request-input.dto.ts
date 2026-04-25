import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';

/**
 * Input для получения заявки по ID
 */
@InputType()
export class GetRequestInput {
  @Field(() => Int, { description: 'ID заявки' })
  @IsNumber()
  id!: number;
}
