import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('ProcessSummary')
export class ProcessSummaryDTO {
  @Field() processType!: string;
  @Field() processHash!: string;
  @Field() coopname!: string;
  @Field({ nullable: true }) username?: string;
  @Field() firstSeenAt!: Date;
  @Field() lastSeenAt!: Date;
  // actionCount/deltaCount/documentCount удалены: N+1 counters на каждой
  // странице listProcesses были запросы 300+ на request. UI читает
  // getProcess(hash) при раскрытии — там счётчики выводимы из массивов.
}
