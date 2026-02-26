import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * DTO для получения результата
 */
@InputType('GetResultInput')
export class GetResultInputDTO {
  @Field(() => String, { description: 'ID результата' })
  @IsString()
  _id!: string;
}
