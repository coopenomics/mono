import { ObjectType, Field, InputType, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsNumber } from 'class-validator';

@ObjectType('ProcessStepPosition')
@InputType('ProcessStepPositionInput')
export class ProcessStepPositionDTO {
  @Field(() => Float)
  @IsNumber()
  x!: number;

  @Field(() => Float)
  @IsNumber()
  y!: number;
}

@ObjectType('ProcessStepTemplate')
export class ProcessStepTemplateDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  estimate?: number;

  @Field(() => ProcessStepPositionDTO)
  position!: ProcessStepPositionDTO;

  @Field(() => Boolean, { nullable: true })
  is_start?: boolean;
}

@InputType('ProcessStepTemplateInput')
export class ProcessStepTemplateInputDTO {
  @Field(() => String)
  @IsString()
  id!: string;

  @Field(() => String)
  @IsString()
  title!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  estimate?: number;

  @Field(() => ProcessStepPositionDTO)
  position!: ProcessStepPositionDTO;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  is_start?: boolean;
}
