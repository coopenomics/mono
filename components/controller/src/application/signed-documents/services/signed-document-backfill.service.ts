import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DocumentDomainService } from '~/domain/document/services/document-domain.service';
import {
  SIGNED_DOCUMENT_REPOSITORY,
  type SignedDocumentRepository,
} from '~/domain/document/repository/signed-document.repository';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import { SignedDocumentRole } from '~/domain/document/enums/signed-document-role.enum';
import { SignedDocumentIngestionService } from './signed-document-ingestion.service';
import config from '~/config/config';
import type { IAction } from '~/types/common';

export interface BackfillStats {
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
}

interface BackfillPass {
  type: string;
  status: SignedDocumentStatus;
  /** Документ процесса (решение, акт, связь) — своя строка журнала с этой ролью. */
  role?: SignedDocumentRole;
}

// Порядок важен: сперва базовые записи (submitted/resolved), затем смена статусов поверх.
const PASSES: BackfillPass[] = [
  { type: 'newsubmitted', status: SignedDocumentStatus.Submitted },
  { type: 'newresolved', status: SignedDocumentStatus.Resolved },
  // newdeclined пока не приходит как registry-action (см. C28-21); пройдёт пустым — это безопасно.
  { type: 'newdeclined', status: SignedDocumentStatus.Declined },
];

/**
 * Журнал документов: решения, акты и связанные документы — по строке на документ.
 * Проход идёт после заявлений, чтобы строка заявления того же документа имела приоритет.
 */
const PART_PASSES: BackfillPass[] = [
  { type: 'newdecision', status: SignedDocumentStatus.Resolved, role: SignedDocumentRole.Decision },
  { type: 'newact', status: SignedDocumentStatus.Resolved, role: SignedDocumentRole.Act },
  { type: 'newlink', status: SignedDocumentStatus.Resolved, role: SignedDocumentRole.Link },
];

const PAGE_LIMIT = 100;

/**
 * Разовый backfill реестра подписанных документов (C28-21).
 *
 * Сканирует все действия soviet (newsubmitted/newresolved/newdeclined) через explorer-источник,
 * для каждого достаёт документ из хранилища фабрики и складывает в Postgres-проекцию.
 * Идемпотентен по (coopname, doc_hash) — повторный прогон безопасен (package НЕ уникален:
 * в одном процессе несколько разных документов, поэтому ключ записи — doc_hash).
 *
 * Запуск автоматически ОДИН РАЗ при первом старте с этой фичей: если реестр по кооперативу пуст —
 * затягиваем всю историю. Принудительный повторный прогон — флагом `SIGNED_DOCS_BACKFILL_ON_BOOT=true`.
 * Выполняется детачем в onApplicationBootstrap (после инициализации всех модулей — генератор уже
 * подключён к хранилищу), чтобы не блокировать старт. Метод `run()` пригоден и для отдельного CLI.
 */
@Injectable()
export class SignedDocumentBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SignedDocumentBackfillService.name);

  constructor(
    private readonly documentDomainService: DocumentDomainService,
    private readonly ingestion: SignedDocumentIngestionService,
    @Inject(SIGNED_DOCUMENT_REPOSITORY) private readonly repository: SignedDocumentRepository
  ) {}

  onApplicationBootstrap(): void {
    // Детачем: не блокируем старт приложения долгим сканом истории.
    this.maybeRunOnBoot().catch((error) => {
      this.logger.error(`Ошибка фонового backfill реестра: ${error?.message}`);
    });
  }

  private async maybeRunOnBoot(): Promise<void> {
    const forced = process.env.SIGNED_DOCS_BACKFILL_ON_BOOT === 'true';
    if (!forced) {
      const existing = await this.repository.count(config.coopname);
      if (existing > 0) {
        // Узел ведёт журнал документов после реестра заявлений: строки документов процесса
        // дописываются один раз, пакеты прежних строк не меняются.
        if ((await this.repository.countParts(config.coopname)) === 0) {
          // i18n-ignore: подпись прохода в журнале узла — текст для оператора, не для пайщика
          await this.runPasses(PART_PASSES, 'журнала документов процесса');
          return;
        }
        this.logger.log(`Реестр подписанных документов не пуст (${existing}) — авто-backfill пропущен.`);
        return;
      }
    }
    await this.run();
  }

  /** Проход по набору типов действий с итогом в журнале узла. */
  private async runPasses(passes: BackfillPass[], label: string): Promise<BackfillStats> {
    const stats: BackfillStats = { scanned: 0, created: 0, updated: 0, skipped: 0 };
    this.logger.log(`Старт прохода ${label}...`);
    for (const pass of passes) await this.runPass(pass, stats);
    this.logger.log(
      `Проход ${label} завершён. scanned=${stats.scanned} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`
    );
    return stats;
  }

  async run(): Promise<BackfillStats> {
    const stats: BackfillStats = { scanned: 0, created: 0, updated: 0, skipped: 0 };
    this.logger.log('Старт backfill реестра подписанных документов...');

    for (const pass of [...PASSES, ...PART_PASSES]) {
      await this.runPass(pass, stats);
    }

    this.logger.log(
      `Backfill завершён. scanned=${stats.scanned} created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`
    );
    return stats;
  }

  private async runPass(pass: BackfillPass, stats: BackfillStats): Promise<void> {
    let page = 1;

    while (true) {
      // Скоуп прежнего chairman-пути getDocuments задавался как {name: type, receiver: coopname}:
      // обозреватель держал в своей mongo ВСЕ трейсы действия (по одному на каждого
      // нотифицируемого), и receiver=coopname отбирал из них ровно один — наш.
      //
      // В собственной базе узла такого выбора нет: consumer сохраняет только основной
      // трейс (receiver == account) и только действия нашего кооператива, поэтому
      // условие по receiver здесь не нужно — в базе и так один трейс на документ.
      // Оставить его означало бы искать receiver='voskhod' там, где записан 'soviet',
      // и не найти ничего.
      const response = await this.documentDomainService.getImmutableSignedDocuments({
        type: pass.type,
        query: {},
        page,
        limit: PAGE_LIMIT,
      });

      const results = (response?.results ?? []) as unknown as IAction[];
      if (results.length === 0) break;

      for (const action of results) {
        stats.scanned++;
        try {
          const result = pass.role
            ? await this.ingestion.ingestPart(action, pass.role)
            : await this.ingestion.ingestAction(action, pass.status);
          stats[result === 'created' ? 'created' : result === 'updated' ? 'updated' : 'skipped']++;
        } catch (error: any) {
          // Одна битая запись (напр. не-парсибельная дата у legacy-документа) не должна ронять
          // весь прогон backfill — логируем и идём дальше.
          stats.skipped++;
          this.logger.warn(`Пропущен документ при backfill (${pass.type}): ${error?.message}`);
        }
      }

      if (results.length < PAGE_LIMIT) break;
      page++;
    }
  }
}
