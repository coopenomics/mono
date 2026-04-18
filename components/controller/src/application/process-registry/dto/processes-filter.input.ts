import { Field, InputType, Int } from '@nestjs/graphql';

@InputType('ProcessesFilter')
export class ProcessesFilterInput {
  @Field() coopname!: string;
  @Field({ nullable: true }) processType?: string;
  @Field({ nullable: true }) username?: string;
  @Field(() => Int, { nullable: true }) fromBlock?: number;
  @Field(() => Int, { nullable: true }) toBlock?: number;
}
