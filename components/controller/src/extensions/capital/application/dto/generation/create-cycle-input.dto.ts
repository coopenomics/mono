import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { CycleStatus } from '../../../domain/enums/cycle-status.enum';
import { t } from '../../../i18n';

/**
 * GraphQL Input DTO для создания цикла
 */
@InputType('CreateCycleInput')
export class CreateCycleInputDTO {
  @Field(() => String, {
    description: 'Название цикла',
  })
  @IsNotEmpty({ message: t('capital.createCycleInput.name.required') })
  @IsString({ message: t('capital.createCycleInput.name.string') })
  name!: string;

  @Field(() => String, {
    description: 'Дата начала цикла (ISO 8601)',
  })
  @IsNotEmpty({ message: t('capital.createCycleInput.startDate.required') })
  @IsDateString({}, { message: t('capital.createCycleInput.startDate.isoFormat') })
  start_date!: string;

  @Field(() => String, {
    description: 'Дата окончания цикла (ISO 8601)',
  })
  @IsNotEmpty({ message: t('capital.createCycleInput.endDate.required') })
  @IsDateString({}, { message: t('capital.createCycleInput.endDate.isoFormat') })
  end_date!: string;

  @Field(() => CycleStatus, {
    nullable: true,
    description: 'Статус цикла',
    defaultValue: CycleStatus.FUTURE,
  })
  @IsOptional()
  @IsEnum(CycleStatus, { message: t('capital.createCycleInput.status.invalid') })
  status?: CycleStatus;
}
