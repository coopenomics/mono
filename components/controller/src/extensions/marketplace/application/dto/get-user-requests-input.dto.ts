import { InputType, Field, Int } from '@nestjs/graphql';
import { IsOptional, IsNumber, Min } from 'class-validator';

/**
 * Input для получения заявок пользователя
 */
@InputType()
export class GetUserRequestsInput {
  @Field(() => Int, { description: 'Максимальное количество результатов', nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
