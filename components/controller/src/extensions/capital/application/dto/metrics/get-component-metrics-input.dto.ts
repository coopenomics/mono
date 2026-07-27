import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { MetricStatus } from '../../../domain/enums/metric-status.enum';

@InputType('GetComponentMetricsInput')
export class GetComponentMetricsInputDTO {
  @Field(() => String, { description: 'Хеш компонента' })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;

  @Field(() => MetricStatus, {
    nullable: true,
    description: 'Фильтр по статусу; по умолчанию только активные',
  })
  @IsOptional()
  @IsEnum(MetricStatus)
  status?: MetricStatus;
}
