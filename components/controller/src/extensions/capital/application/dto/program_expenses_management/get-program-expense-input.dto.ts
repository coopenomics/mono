import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('GetProgramExpenseInput')
export class GetProgramExpenseInputDTO {
  @Field(() => String, { description: 'Внутренний ID базы данных' })
  @IsNotEmpty()
  @IsString()
  _id!: string;
}
