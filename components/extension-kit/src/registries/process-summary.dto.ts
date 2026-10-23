import { Field, ObjectType } from '@nestjs/graphql';
import { createPaginationResult } from '../dto/pagination.dto';

@ObjectType('ProcessSummary')
export class ProcessSummaryDTO {
  @Field(() => String) processType!: string;
  @Field(() => String) processHash!: string;
  @Field(() => String) coopname!: string;
  @Field(() => String, { nullable: true }) username?: string;
  @Field(() => Date) firstSeenAt!: Date;
  @Field(() => Date) lastSeenAt!: Date;
  @Field(() => String, { nullable: true, description: 'Сумма главной операции процесса — наибольшая среди его операций' })
  amount?: string;
  @Field(() => String, { nullable: true, description: 'Назначение главной операции процесса' })
  memo?: string;
  // actionCount/deltaCount/documentCount удалены: N+1 counters на каждой
  // странице listProcesses были запросы 300+ на request. UI читает
  // getProcess(hash) при раскрытии — там счётчики выводимы из массивов.
}

/**
 * Страница реестра процессов. Тип один на схему: его отдают и операция ядра,
 * и операция приложения, которое показывает реестр по своей таблице прав.
 */
export const PaginatedProcessSummary = createPaginationResult(ProcessSummaryDTO, 'ProcessSummary');
