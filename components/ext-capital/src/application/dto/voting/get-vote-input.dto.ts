import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * DTO для получения голоса
 */
@InputType('GetVoteInput')
export class GetVoteInputDTO {
  @Field(() => String, { description: 'ID голоса' })
  @IsString()
  _id!: string;
}
