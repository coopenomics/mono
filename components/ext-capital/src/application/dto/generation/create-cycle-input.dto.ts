import { Field, InputType } from '@nestjs/graphql';
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
  @IsNotEmpty({ message: 'Название цикла не должно быть пустым' })
  @IsString({ message: 'Название цикла должно быть строкой' })
  name!: string;

  @Field(() => String, {
    description: 'Дата начала цикла (ISO 8601)',
  })
  @IsNotEmpty({ message: 'Дата начала цикла не должна быть пустой' })
  @IsDateString({}, { message: 'Дата начала цикла должна быть в формате ISO 8601' })
  start_date!: string;

  @Field(() => String, {
    description: 'Дата окончания цикла (ISO 8601)',
  })
  @IsNotEmpty({ message: 'Дата окончания цикла не должна быть пустой' })
  @IsDateString({}, { message: 'Дата окончания цикла должна быть в формате ISO 8601' })
  end_date!: string;

  @Field(() => CycleStatus, {
    nullable: true,
    description: 'Статус цикла',
    defaultValue: CycleStatus.FUTURE,
  })
  @IsOptional()
  @IsEnum(CycleStatus, { message: 'Неверный статус цикла' })
  status?: CycleStatus;
}
