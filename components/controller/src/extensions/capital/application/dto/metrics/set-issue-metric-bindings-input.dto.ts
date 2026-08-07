import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

@InputType('IssueMetricBindingItemInput')
export class IssueMetricBindingItemInputDTO {
  @Field(() => String, { description: 'Хеш метрики' })
  @IsNotEmpty()
  @IsString()
  metric_hash!: string;

  @Field(() => Float, { description: 'Плановый вклад (может быть отрицательным)' })
  @IsNumber()
  delta!: number;
}

@InputType('SetIssueMetricBindingsInput')
export class SetIssueMetricBindingsInputDTO {
  @Field(() => String, { description: 'Хеш задачи' })
  @IsNotEmpty()
  @IsString()
  issue_hash!: string;

  @Field(() => [IssueMetricBindingItemInputDTO], {
    description: 'Полный список привязок задачи к метрикам',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IssueMetricBindingItemInputDTO)
  bindings!: IssueMetricBindingItemInputDTO[];
}
