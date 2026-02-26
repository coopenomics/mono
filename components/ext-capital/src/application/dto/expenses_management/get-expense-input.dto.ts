import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO для получения расхода по ID
 */
@InputType('GetExpenseInput')
export class GetExpenseInputDTO {
  @Field(() => String, { description: 'Внутренний ID базы данных' })
  @IsNotEmpty()
  @IsString()
  _id!: string;
}
