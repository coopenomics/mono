import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  contentDay,
  contentFact,
  processContentRegistry,
  type ProcessContentDTO,
  type ProcessContentLineDTO,
  type ProcessContentProvider,
} from '@coopenomics/extension-kit';
import { ACCOUNT_PORT, type IAccountPort } from '@coopenomics/innercoop';
import { Ledger2 } from 'cooptypes';
import { ProcessRegistryService } from '~/domain/process-registry/services/process-registry.service';
import { AccountKind } from '~/application/account/enum/account-kind.enum';
import { t } from '~/i18n';

/** Предел строк операций в карточке: длинная нитка видна целиком в учёте ниже. */
const OPERATIONS_LIMIT = 8;

interface ApplyRow {
  operationCode: string;
  username: string | null;
  quantity: string | null;
}

/** Роль участника нитки: пайщик, кооперативный участок либо сам кооператив. */
type SubjectRole = 'participant' | 'branch' | 'cooperative'; // i18n-ignore

interface Subject {
  name: string;
  role: SubjectRole;
}

/** Кооператив в нитке — сторона учёта (фонды), не пайщик: строкой пайщиков не называется. */
function roleOf(kind: string): SubjectRole {
  if (kind === AccountKind.branch) return 'branch';
  if (kind === AccountKind.cooperative) return 'cooperative';
  return 'participant';
}

/**
 * Общее содержание процесса для стола бухгалтера — когда приложение процесса
 * его не описывает или запись сущности уже стёрта по завершении. Сервис берёт
 * сведения из нитки процесса: кто участвует (пайщик, участок — каждый своей
 * строкой, участок видно сразу), какие операции прошли и на какие суммы, с
 * каким назначением и в какие даты.
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

  async content(processHash: string, coopname: string): Promise<ProcessContentDTO | null> {
    const hash = processHash.toLowerCase();
    const page = await this.processes.listProcesses({ coopname, processHash: hash }, { page: 1, limit: 1, sortOrder: 'DESC' });
    const summary = page.items[0];
    if (!summary) return null;

    const applies = await this.applies(hash, coopname);
    const subjects = await this.subjects(applies.map((a) => a.username).concat(summary.username ?? null));
    const names = (role: SubjectRole): string =>
      [...new Set([...subjects.values()].filter((s) => s.role === role).map((s) => s.name))].join(', ');

    return {
      // Процесс называет заголовок места (панель, страница) — карточка его не повторяет.
      title: '',
      subtitle: null,
      image_url: null,
      amount: summary.amount ?? null,
      amount_label: summary.amount ? t('processRegistry.content.summary.amountLabel') : null,
      status: null,
      facts: [
        ...contentFact(t('processRegistry.content.summary.participant'), names('participant')),
        ...contentFact(t('processRegistry.content.summary.branch'), names('branch')),
        ...contentFact(t('processRegistry.content.summary.memo'), summary.memo),
        ...contentFact(t('processRegistry.content.summary.startedAt'), contentDay(summary.firstSeenAt)),
        ...contentFact(t('processRegistry.content.summary.lastEventAt'), contentDay(summary.lastSeenAt)),
      ],
      links: [],
      lines: this.lines(applies, subjects),
    };
  }

  /** Операции нитки процесса по порядку: код, чья операция, сумма. */
  private async applies(hash: string, coopname: string): Promise<ApplyRow[]> {
    const view = await this.processes.getProcess(hash, coopname);
    return view.actions
      .filter((action) => action.name === 'apply') // i18n-ignore
      .map((action) => {
        const data = (action.data ?? {}) as { operation_code?: string; username?: string; amount?: string };
        return { operationCode: String(data.operation_code ?? ''), username: data.username ?? null, quantity: data.amount ?? null };
      })
      .filter((row) => !!row.operationCode);
  }

  /** Состав процесса: строка на операцию — название, чья операция, сумма. */
  private lines(applies: ApplyRow[], subjects: Map<string, Subject>): ProcessContentLineDTO[] {
    if (applies.length < 2) return [];
    return applies.slice(0, OPERATIONS_LIMIT).map((row) => ({
      label: Ledger2.getOperationHumanName(row.operationCode) ?? row.operationCode,
      subject: row.username ? subjects.get(row.username)?.name ?? row.username : null,
      amount: row.quantity,
    }));
  }

  /** Имя и вид каждого участника: участок называется участком, а не пайщиком. */
  private async subjects(usernames: (string | null)[]): Promise<Map<string, Subject>> {
    const unique = [...new Set(usernames.filter((u): u is string => !!u))];
    const found = await Promise.all(unique.map(async (username) => [username, await this.subject(username)] as const));
    return new Map(found);
  }

  private async subject(username: string): Promise<Subject> {
    try {
      const account = await this.accounts.getAccount(username);
      const name = (await this.accounts.getDisplayName(username)) || username;
      return { name, role: roleOf(account.account_kind) };
    } catch {
      return { name: username, role: 'participant' };
    }
  }
}
