import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString } from 'class-validator';

@InputType('ProgramExpenseFilter')
export class ProgramExpenseFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Фильтр по инициатору расхода' })
  @IsOptional()
  @IsString()
  username?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по статусу расхода' })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => String, { nullable: true, description: 'Фильтр по ID фонда списания' })
  @IsOptional()
  @IsString()
  fundId?: string;
}
