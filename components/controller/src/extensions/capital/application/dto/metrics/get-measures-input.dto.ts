import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { MetricStatus } from '../../../domain/enums/metric-status.enum';

@InputType('GetMeasuresInput')
export class GetMeasuresInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => MetricStatus, {
    nullable: true,
    description: 'Фильтр по статусу; без фильтра — все меры (для мониторинга)',
  })
  @IsOptional()
  @IsEnum(MetricStatus)
  status?: MetricStatus;
}
