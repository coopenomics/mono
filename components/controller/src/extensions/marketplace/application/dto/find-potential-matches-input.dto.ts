import { InputType, Field, Int } from '@nestjs/graphql';
import { IsNumber } from 'class-validator';

/**
 * Input для поиска потенциальных совпадений
 */
@InputType()
export class FindPotentialMatchesInput {
  @Field(() => Int, { description: 'ID заявки для поиска совпадений' })
  @IsNumber()
  requestId!: number;
}
