import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * DTO для получения долга
 */
@InputType('GetDebtInput')
export class GetDebtInputDTO {
  @Field(() => String, { description: 'ID долга' })
  @IsString()
  _id!: string;
}
