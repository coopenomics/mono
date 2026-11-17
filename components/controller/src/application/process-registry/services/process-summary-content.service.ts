import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  contentDay,
  contentFact,
  processContentRegistry,
  type ProcessContentDTO,
  type ProcessContentProvider,
} from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { Ledger2 } from 'cooptypes';
import { ProcessRegistryService } from '~/domain/process-registry/services/process-registry.service';
import { t } from '~/i18n';

/**
 * Общее содержание процесса для стола бухгалтера — когда приложение процесса
 * его не описывает или запись сущности уже стёрта по завершении. Сервис берёт
 * сведения из сводки процесса в реестре: что за процесс, чей, на какую сумму,
 * с каким назначением и в какие даты.
 */
@Injectable()
export class ProcessSummaryContentService implements OnModuleInit, ProcessContentProvider {
  constructor(
    private readonly processes: ProcessRegistryService,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort
  ) {}

  onModuleInit(): void {
    processContentRegistry.registerFallback(this);
  }

  async content(processHash: string, coopname: string, processType: string): Promise<ProcessContentDTO | null> {
    const page = await this.processes.listProcesses(
      { coopname, processHash: processHash.toLowerCase() },
      { page: 1, limit: 1, sortOrder: 'DESC' }
    );
    const summary = page.items[0];
    if (!summary) return null;
    const subject = summary.username ? await this.nameOf(summary.username) : '';
    const meta = Ledger2.LEDGER2_PROCESS_REGISTRY.find((p) => p.type === (summary.processType || processType));
    return {
      title: meta?.human_name ?? summary.processType,
      subtitle: subject || null,
      image_url: null,
      amount: summary.amount ?? null,
      amount_label: summary.amount ? t('processRegistry.content.summary.amountLabel') : null,
      status: null,
      facts: [
        ...contentFact(t('processRegistry.content.summary.subject'), subject),
        ...contentFact(t('processRegistry.content.summary.memo'), summary.memo),
        ...contentFact(t('processRegistry.content.summary.startedAt'), contentDay(summary.firstSeenAt)),
        ...contentFact(t('processRegistry.content.summary.lastEventAt'), contentDay(summary.lastSeenAt)),
      ],
      links: [],
    };
  }

  /** ФИО пайщика, название организации или участка; без имени — учётное имя. */
  private async nameOf(account: string): Promise<string> {
    try {
      return (await this.accounts.getDisplayName(account)) || account;
    } catch {
      return account;
    }
  }
}
