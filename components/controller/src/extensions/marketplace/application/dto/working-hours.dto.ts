import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('WorkingHoursBreak')
export class WorkingHoursBreakDTO {
  @Field(() => String)
  start!: string;

  @Field(() => String)
  end!: string;
}

@ObjectType('WorkingHoursDay')
export class WorkingHoursDayDTO {
  @Field(() => String)
  open!: string;

  @Field(() => String)
  close!: string;

  @Field(() => [WorkingHoursBreakDTO])
  breaks!: WorkingHoursBreakDTO[];
}

@ObjectType('WorkingHours')
export class WorkingHoursDTO {
  @Field(() => WorkingHoursDayDTO, { nullable: true })
  mon?: WorkingHoursDayDTO;

  @Field(() => WorkingHoursDayDTO, { nullable: true })
  tue?: WorkingHoursDayDTO;

  @Field(() => WorkingHoursDayDTO, { nullable: true })
  wed?: WorkingHoursDayDTO;

  @Field(() => WorkingHoursDayDTO, { nullable: true })
  thu?: WorkingHoursDayDTO;

  @Field(() => WorkingHoursDayDTO, { nullable: true })
  fri?: WorkingHoursDayDTO;

  @Field(() => WorkingHoursDayDTO, { nullable: true })
  sat?: WorkingHoursDayDTO;

  @Field(() => WorkingHoursDayDTO, { nullable: true })
  sun?: WorkingHoursDayDTO;
}
