import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ProcessSummary')
export class ProcessSummaryDTO {
  @Field() processType!: string;
  @Field() processHash!: string;
  @Field() coopname!: string;
  @Field({ nullable: true }) username?: string;
  @Field() firstSeenAt!: Date;
  @Field() lastSeenAt!: Date;
  @Field(() => Int) actionCount!: number;
  @Field(() => Int) deltaCount!: number;
  @Field(() => Int) documentCount!: number;
}
