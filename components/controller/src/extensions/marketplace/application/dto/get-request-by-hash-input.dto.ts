import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * Input для получения заявки по хэшу
 */
@InputType()
export class GetRequestByHashInput {
  @Field({ description: 'Хэш заявки' })
  @IsString()
  hash!: string;
}
