import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { CycleStatus } from '../../../domain/enums/cycle-status.enum';

/**
 * GraphQL Input DTO для создания цикла
 */
@InputType('CreateCycleInput')
export class CreateCycleInputDTO {
  @Field(() => String, {
    description: 'Название цикла',
  })
  @IsNotEmpty({ message: validationMessage('capital.createCycleInput.name.required') })
  @IsString({ message: validationMessage('capital.createCycleInput.name.string') })
  name!: string;

  @Field(() => String, {
    description: 'Дата начала цикла (ISO 8601)',
  })
  @IsNotEmpty({ message: validationMessage('capital.createCycleInput.startDate.required') })
  @IsDateString({}, { message: validationMessage('capital.createCycleInput.startDate.isoFormat') })
  start_date!: string;

  @Field(() => String, {
    description: 'Дата окончания цикла (ISO 8601)',
  })
  @IsNotEmpty({ message: validationMessage('capital.createCycleInput.endDate.required') })
  @IsDateString({}, { message: validationMessage('capital.createCycleInput.endDate.isoFormat') })
  end_date!: string;

  @Field(() => CycleStatus, {
    nullable: true,
    description: 'Статус цикла',
    defaultValue: CycleStatus.FUTURE,
  })
  @IsOptional()
  @IsEnum(CycleStatus, { message: validationMessage('capital.createCycleInput.status.invalid') })
  status?: CycleStatus;
}
