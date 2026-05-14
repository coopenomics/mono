import { Field, InputType } from '@nestjs/graphql';

@InputType('WorkingHoursBreakInput')
export class WorkingHoursBreakInputDTO {
  @Field(() => String, { description: 'Начало перерыва (HH:mm)' })
  start!: string;

  @Field(() => String, { description: 'Конец перерыва (HH:mm)' })
  end!: string;
}

@InputType('WorkingHoursDayInput')
export class WorkingHoursDayInputDTO {
  @Field(() => String, { description: 'Время открытия (HH:mm)' })
  open!: string;

  @Field(() => String, { description: 'Время закрытия (HH:mm)' })
  close!: string;

  @Field(() => [WorkingHoursBreakInputDTO], { description: 'Перерывы внутри рабочего дня', defaultValue: [] })
  breaks!: WorkingHoursBreakInputDTO[];
}

@InputType('WorkingHoursInput')
export class WorkingHoursInputDTO {
  @Field(() => WorkingHoursDayInputDTO, { nullable: true })
  mon?: WorkingHoursDayInputDTO;

  @Field(() => WorkingHoursDayInputDTO, { nullable: true })
  tue?: WorkingHoursDayInputDTO;

  @Field(() => WorkingHoursDayInputDTO, { nullable: true })
  wed?: WorkingHoursDayInputDTO;

  @Field(() => WorkingHoursDayInputDTO, { nullable: true })
  thu?: WorkingHoursDayInputDTO;

  @Field(() => WorkingHoursDayInputDTO, { nullable: true })
  fri?: WorkingHoursDayInputDTO;

  @Field(() => WorkingHoursDayInputDTO, { nullable: true })
  sat?: WorkingHoursDayInputDTO;

  @Field(() => WorkingHoursDayInputDTO, { nullable: true })
  sun?: WorkingHoursDayInputDTO;
}
