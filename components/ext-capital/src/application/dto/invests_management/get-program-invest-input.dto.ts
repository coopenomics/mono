import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * DTO для получения программной инвестиции
 */
@InputType('GetProgramInvestInput')
export class GetProgramInvestInputDTO {
  @Field(() => String, { description: 'ID программной инвестиции' })
  @IsString()
  _id!: string;
}
