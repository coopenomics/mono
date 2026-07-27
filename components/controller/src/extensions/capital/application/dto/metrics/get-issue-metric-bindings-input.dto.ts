import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('GetIssueMetricBindingsInput')
export class GetIssueMetricBindingsInputDTO {
  @Field(() => String, { description: 'Хеш задачи' })
  @IsNotEmpty()
  @IsString()
  issue_hash!: string;
}
