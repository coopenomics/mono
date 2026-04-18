import { Field, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType('ProcessAction')
export class ProcessActionDTO {
  @Field() id!: string;
  @Field() account!: string;
  @Field() name!: string;
  @Field(() => GraphQLJSON, { nullable: true }) data?: unknown;
  @Field() block_num!: number;
  @Field() block_id!: string;
  @Field() global_sequence!: string;
  @Field() transaction_id!: string;
  @Field() created_at!: Date;
}

@ObjectType('ProcessDelta')
export class ProcessDeltaDTO {
  @Field() id!: string;
  @Field() code!: string;
  @Field() scope!: string;
  @Field() table!: string;
  @Field() primary_key!: string;
  @Field() present!: boolean;
  @Field(() => GraphQLJSON, { nullable: true }) value?: unknown;
  @Field() block_num!: number;
  @Field() created_at!: Date;
}

@ObjectType('ProcessDocumentSource')
export class ProcessDocumentSourceDTO {
  @Field() code!: string;
  @Field() table!: string;
  @Field() field!: string;
  @Field() primary_key!: string;
}

@ObjectType('ProcessDocument')
export class ProcessDocumentDTO {
  @Field() hash!: string;
  @Field(() => ProcessDocumentSourceDTO) source!: ProcessDocumentSourceDTO;
  @Field(() => GraphQLJSON) document!: unknown;
  @Field(() => GraphQLJSON, { nullable: true }) raw?: unknown;
}

@ObjectType('ProcessView')
export class ProcessViewDTO {
  @Field() process_type!: string;
  @Field() process_hash!: string;
  @Field() coopname!: string;
  @Field() first_seen_at!: Date;
  @Field() last_seen_at!: Date;
  @Field(() => [ProcessActionDTO]) actions!: ProcessActionDTO[];
  @Field(() => [ProcessDeltaDTO]) delta_history!: ProcessDeltaDTO[];
  @Field(() => [ProcessDocumentDTO]) documents!: ProcessDocumentDTO[];
}
