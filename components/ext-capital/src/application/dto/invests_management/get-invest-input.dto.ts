import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * DTO для получения инвестиции
 */
@InputType('GetInvestInput')
export class GetInvestInputDTO {
  @Field(() => String, { description: 'ID инвестиции' })
  @IsString()
  _id!: string;
}
