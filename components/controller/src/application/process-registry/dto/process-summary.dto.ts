import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('ProcessSummary')
export class ProcessSummaryDTO {
  @Field() processType!: string;
  @Field() processHash!: string;
  @Field() coopname!: string;
  @Field({ nullable: true }) username?: string;
  @Field() firstSeenAt!: Date;
  @Field() lastSeenAt!: Date;
  @Field({ nullable: true, description: 'Сумма главной операции процесса — наибольшая среди его операций' })
  amount?: string;
  @Field({ nullable: true, description: 'Назначение главной операции процесса' })
  memo?: string;
  // actionCount/deltaCount/documentCount удалены: N+1 counters на каждой
  // странице listProcesses были запросы 300+ на request. UI читает
  // getProcess(hash) при раскрытии — там счётчики выводимы из массивов.
}
