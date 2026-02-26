import { ObjectType, Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';
import { ProcessInstanceStatus, ProcessStepStatus } from '../../../domain/enums/process-status.enum';

registerEnumType(ProcessInstanceStatus, { name: 'ProcessInstanceStatus' });
registerEnumType(ProcessStepStatus, { name: 'ProcessStepStatus' });

@ObjectType('ProcessStepState')
export class ProcessStepStateDTO {
  @Field(() => String)
  step_id!: string;

  @Field(() => ProcessStepStatus)
  status!: ProcessStepStatus;

  @Field(() => String, { nullable: true })
  issue_hash?: string;

  @Field(() => Date, { nullable: true })
  completed_at?: Date;
}

@ObjectType('ProcessInstance')
export class ProcessInstanceDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => String)
  template_id!: string;

  @Field(() => String)
  project_hash!: string;

  @Field(() => ProcessInstanceStatus)
  status!: ProcessInstanceStatus;

  @Field(() => String)
  started_by!: string;

  @Field(() => Int)
  cycle!: number;

  @Field(() => [ProcessStepStateDTO])
  step_states!: ProcessStepStateDTO[];

  @Field(() => Date)
  started_at!: Date;

  @Field(() => Date, { nullable: true })
  completed_at?: Date;
}

@InputType('StartProcessInput')
export class StartProcessInputDTO {
  @Field(() => String)
  @IsString()
  template_id!: string;

  @Field(() => String)
  @IsString()
  project_hash!: string;
}

@InputType('CompleteProcessStepInput')
export class CompleteProcessStepInputDTO {
  @Field(() => String)
  @IsString()
  instance_id!: string;

  @Field(() => String)
  @IsString()
  step_id!: string;
}
