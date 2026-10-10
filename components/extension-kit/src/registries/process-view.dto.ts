import { Field, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType('ProcessAction')
export class ProcessActionDTO {
  @Field(() => String) id!: string;
  @Field(() => String) account!: string;
  @Field(() => String) name!: string;
  @Field(() => GraphQLJSON, { nullable: true }) data?: unknown;
  @Field(() => Number) block_num!: number;
  @Field(() => String) block_id!: string;
  @Field(() => String) global_sequence!: string;
  @Field(() => String) transaction_id!: string;
  @Field(() => Date) created_at!: Date;
}

@ObjectType('ProcessDelta')
export class ProcessDeltaDTO {
  @Field(() => String) id!: string;
  @Field(() => String) code!: string;
  @Field(() => String) scope!: string;
  @Field(() => String) table!: string;
  @Field(() => String) primary_key!: string;
  @Field(() => Boolean) present!: boolean;
  @Field(() => GraphQLJSON, { nullable: true }) value?: unknown;
  @Field(() => Number) block_num!: number;
  @Field(() => Date) created_at!: Date;
}

@ObjectType('ProcessDocumentSource')
export class ProcessDocumentSourceDTO {
  @Field(() => String) code!: string;
  @Field(() => String) table!: string;
  @Field(() => String) field!: string;
  @Field(() => String) primary_key!: string;
}

@ObjectType('ProcessDocument')
export class ProcessDocumentDTO {
  @Field(() => String) hash!: string;
  @Field(() => ProcessDocumentSourceDTO) source!: ProcessDocumentSourceDTO;
  @Field(() => GraphQLJSON) document!: unknown;
  @Field(() => GraphQLJSON, { nullable: true }) raw?: unknown;
}

@ObjectType('ProcessView')
export class ProcessViewDTO {
  @Field(() => String) process_type!: string;
  @Field(() => String) process_hash!: string;
  @Field(() => String) coopname!: string;
  @Field(() => Date) first_seen_at!: Date;
  @Field(() => Date) last_seen_at!: Date;
  @Field(() => [ProcessActionDTO]) actions!: ProcessActionDTO[];
  @Field(() => [ProcessDeltaDTO]) delta_history!: ProcessDeltaDTO[];
  @Field(() => [ProcessDocumentDTO]) documents!: ProcessDocumentDTO[];
}
