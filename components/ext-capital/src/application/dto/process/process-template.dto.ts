import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProcessTemplateStatus } from '../../../domain/enums/process-status.enum';
import { ProcessStepTemplateDTO, ProcessStepTemplateInputDTO } from './process-step.dto';
import { ProcessEdgeDTO, ProcessEdgeInputDTO } from './process-edge.dto';

registerEnumType(ProcessTemplateStatus, { name: 'ProcessTemplateStatus' });

@ObjectType('ProcessTemplate')
export class ProcessTemplateDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  coopname!: string;

  @Field(() => String)
  project_hash!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => ProcessTemplateStatus)
  status!: ProcessTemplateStatus;

  @Field(() => String)
  created_by!: string;

  @Field(() => [ProcessStepTemplateDTO])
  steps!: ProcessStepTemplateDTO[];

  @Field(() => [ProcessEdgeDTO])
  edges!: ProcessEdgeDTO[];

  @Field(() => Date)
  created_at!: Date;

  @Field(() => Date)
  updated_at!: Date;
}

@InputType('CreateProcessTemplateInput')
export class CreateProcessTemplateInputDTO {
  @Field(() => String)
  @IsString()
  project_hash!: string;

  @Field(() => String)
  @IsString()
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType('UpdateProcessTemplateInput')
export class UpdateProcessTemplateInputDTO {
  @Field(() => String)
  @IsString()
  id!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => ProcessTemplateStatus, { nullable: true })
  @IsOptional()
  status?: ProcessTemplateStatus;

  @Field(() => [ProcessStepTemplateInputDTO], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessStepTemplateInputDTO)
  steps?: ProcessStepTemplateInputDTO[];

  @Field(() => [ProcessEdgeInputDTO], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessEdgeInputDTO)
  edges?: ProcessEdgeInputDTO[];
}
