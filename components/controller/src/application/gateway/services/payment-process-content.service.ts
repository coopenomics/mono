import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  contentAsset,
  contentDay,
  contentFact,
  processContentRegistry,
  type ProcessContentDTO,
  type ProcessContentProvider,
} from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { PAYMENT_REPOSITORY, type PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { PaymentTypeEnum } from '~/domain/gateway/enums/payment-type.enum';
import { ProcessRegistryService } from '~/domain/process-registry/services/process-registry.service';
import { t, te } from '~/i18n';

/**
 * Процессы, сущность которых — платёж кооператива с тем же хэшем: приём
 * пайщика (вступительный и минимальный паевой взносы), возврат
 * регистрационного взноса при отказе совета, внесение и возврат паевого
 * взноса.
 */
const PAYMENT_PROCESSES = ['p.reg.accept', 'p.reg.refund', 'p.wal.depo', 'p.wal.wthdrw']; // i18n-ignore

/** Подпись из словаря по ключу; неизвестный код показывается как есть. */
function label(group: string, code: string | null | undefined): string | null {
  if (!code) return null;
  const key = `processRegistry.content.payment.${group}.${code}`;
  return te(key) ? t(key) : code;
}

/**
 * Содержание платёжных процессов для стола бухгалтера: кто платит или кому
 * платят, сколько, каким способом и в каком состоянии платёж.
 */
@Injectable()
export class PaymentProcessContentService implements OnModuleInit, ProcessContentProvider {
  constructor(
    @Inject(PAYMENT_REPOSITORY) private readonly payments: PaymentRepository,
    @Inject(ACCOUNT_PORT) private readonly accounts: IAccountPort,
    private readonly processes: ProcessRegistryService
  ) {}

  onModuleInit(): void {
    processContentRegistry.register(PAYMENT_PROCESSES, this);
  }

  async content(processHash: string, coopname: string, processType: string): Promise<ProcessContentDTO | null> {
    const payment = await this.findPayment(processHash.toLowerCase(), coopname, processType);
    if (!payment) return null;
    const participant = await this.nameOf(payment.username);
    return {
      title: label('type', payment.type) ?? t('processRegistry.content.payment.untitled'),
      subtitle: participant,
      image_url: null,
      amount: contentAsset(payment.quantity, payment.symbol, 4),
      amount_label: label('direction', payment.direction),
      status: label('status', payment.status),
      facts: [
        ...contentFact(t('processRegistry.content.payment.participant'), participant),
        ...contentFact(t('processRegistry.content.payment.memo'), payment.memo),
        ...contentFact(t('processRegistry.content.payment.createdAt'), contentDay(payment.created_at)),
        ...contentFact(t('processRegistry.content.payment.completedAt'), contentDay(payment.completed_at)),
        ...contentFact(t('processRegistry.content.payment.failedAt'), contentDay(payment.failed_at)),
        ...contentFact(t('processRegistry.content.payment.message'), payment.message),
      ],
      links: [],
    };
  }

  /**
   * Платёж процесса. У возврата и паевого взноса хэш процесса — хэш платежа.
   * У приёма пайщика хэш процесса — хэш регистрации: пайщика называет строка
   * кандидата в самом процессе, платёж — последний регистрационный платёж
   * этого пайщика.
   */
  private async findPayment(hash: string, coopname: string, processType: string) {
    const direct = await this.payments.findByHash(hash);
    if (direct || processType !== 'p.reg.accept') return direct; // i18n-ignore
    const view = await this.processes.getProcess(hash, coopname);
    const candidate = view.delta_history.find((delta) => delta.table === 'candidates2')?.value as { username?: string } | undefined; // i18n-ignore
    return candidate?.username
      ? this.payments.findLatestByUsernameAndType(candidate.username, PaymentTypeEnum.REGISTRATION)
      : null;
  }

  /** ФИО пайщика или название организации; без имени — учётное имя. */
  private async nameOf(account: string): Promise<string> {
    try {
      return (await this.accounts.getDisplayName(account)) || account;
    } catch {
      return account;
    }
  }
}
