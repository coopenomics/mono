import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@ObjectType('ProcessEdge')
export class ProcessEdgeDTO {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  source!: string;

  @Field(() => String)
  target!: string;
}

@InputType('ProcessEdgeInput')
export class ProcessEdgeInputDTO {
  @Field(() => String)
  @IsString()
  id!: string;

  @Field(() => String)
  @IsString()
  source!: string;

  @Field(() => String)
  @IsString()
  target!: string;
}
