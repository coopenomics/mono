import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cooperative, SovietContract } from 'cooptypes';
import { DocumentPackageAggregator } from '~/domain/document/aggregators/document-package.aggregator';
import {
  SIGNED_DOCUMENT_REPOSITORY,
  type SignedDocumentRepository,
} from '~/domain/document/repository/signed-document.repository';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import config from '~/config/config';
import type { IAction } from '~/types/common';
import moment from 'moment-timezone';

const SOVIET = SovietContract.contractName.production;
const Registry = SovietContract.Actions.Registry;

export type IngestResult = 'created' | 'updated' | 'skipped';

/**
 * Наполнение реестра подписанных документов (Postgres-проекция, C28-21).
 *
 * Источник — внутренняя событийная шина (EventEmitter2): парсер ретранслирует blockchain-события
 * контракта soviet как `action::soviet::*`. На каждое релевантное событие собирается ГОТОВЫЙ агрегат
 * пакета (DocumentPackageAggregator) и кладётся в PG целиком — чтобы getDocuments/поиск работали
 * из Postgres без сборки на лету. Парсер не трогаем (parser1→parser2 прозрачно для подписчика).
 *
 * - newsubmitted/newresolved/newdeclined — несут заявление: пересобираем агрегат + ставим статус;
 * - newdecision/newact/newlink — досборка: пересобираем агрегат по сохранённому действию-носителю,
 *   статус не меняем.
 */
@Injectable()
export class SignedDocumentIngestionService {
  private readonly logger = new Logger(SignedDocumentIngestionService.name);

  constructor(
    @Inject(SIGNED_DOCUMENT_REPOSITORY) private readonly repository: SignedDocumentRepository,
    private readonly aggregator: DocumentPackageAggregator
  ) {}

  @OnEvent(`action::${SOVIET}::${Registry.NewSubmitted.actionName}`)
  async onNewSubmitted(action: IAction): Promise<void> {
    await this.safeStatusEvent(action, SignedDocumentStatus.Submitted, Registry.NewSubmitted.actionName);
  }

  @OnEvent(`action::${SOVIET}::${Registry.NewResolved.actionName}`)
  async onNewResolved(action: IAction): Promise<void> {
    await this.safeStatusEvent(action, SignedDocumentStatus.Resolved, Registry.NewResolved.actionName);
  }

  @OnEvent(`action::${SOVIET}::${Registry.NewDeclined.actionName}`)
  async onNewDeclined(action: IAction): Promise<void> {
    await this.safeStatusEvent(action, SignedDocumentStatus.Declined, Registry.NewDeclined.actionName);
  }

  @OnEvent(`action::${SOVIET}::${Registry.NewDecision.actionName}`)
  async onNewDecision(action: IAction): Promise<void> {
    await this.safeReassemble(action, Registry.NewDecision.actionName);
  }

  @OnEvent(`action::${SOVIET}::${Registry.NewAct.actionName}`)
  async onNewAct(action: IAction): Promise<void> {
    await this.safeReassemble(action, Registry.NewAct.actionName);
  }

  @OnEvent(`action::${SOVIET}::${Registry.NewLink.actionName}`)
  async onNewLink(action: IAction): Promise<void> {
    await this.safeReassemble(action, Registry.NewLink.actionName);
  }

  /**
   * Идемпотентно записывает действие-носитель заявления в реестр.
   * Используется и листенерами шины, и backfill'ом.
   */
  async ingestAction(action: IAction, status: SignedDocumentStatus): Promise<IngestResult> {
    const data = (action?.data ?? {}) as Record<string, any>;
    // Ключ записи — doc_hash (идентичность документа). hash включает подписи, поэтому у одного
    // документа бывает несколько hash (версии по мере накопления подписей — напр. акт приёма-передачи:
    // первая/вторая подпись дают разные hash при одном doc_hash). Держим КРАЙНЮЮ версию по номеру блока,
    // иначе документ задвоился бы в списке. package НЕ ключ: в одном процессе бывает несколько разных
    // документов с разными подписантами (обмен в marketplace).
    const docHash: string | undefined = data.document?.doc_hash;
    if (!docHash) return 'skipped';
    const hash: string = data.document?.hash || '';
    const packageHash: string = data.package || '';
    const coopname: string = data.coopname || config.coopname;
    const incomingBlock = this.toBlockNum(action?.block_num);

    const existing = await this.repository.getState(coopname, docHash);
    if (existing) {
      // Не понижаем статус: submitted не перетирает resolved/declined.
      if (status === SignedDocumentStatus.Submitted && existing.status !== SignedDocumentStatus.Submitted) {
        return 'skipped';
      }
      // Не откатываем на более старую версию подписи (меньший номер блока).
      if (incomingBlock !== null && existing.blockNum !== null && incomingBlock < existing.blockNum) {
        return 'skipped';
      }
      // Идемпотентность: тот же статус и не новее по блоку — обновлять нечего (повторный backfill безопасен).
      if (
        existing.status === status &&
        (incomingBlock === null || existing.blockNum === null || incomingBlock <= existing.blockNum)
      ) {
        return 'skipped';
      }
    }

    await this.assembleAndUpsert(action, status, coopname, docHash, hash, packageHash);
    return existing ? 'updated' : 'created';
  }

  private toBlockNum(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private async safeStatusEvent(action: IAction, status: SignedDocumentStatus, label: string): Promise<void> {
    try {
      const result = await this.ingestAction(action, status);
      if (result !== 'skipped') {
        this.logger.log(`[${label}] запись реестра ${result}: package=${this.shortPackage(action)}`);
      }
    } catch (error: any) {
      this.logger.warn(`Ошибка ingestion события ${label}: ${error?.message}`);
    }
  }

  private async safeReassemble(action: IAction, label: string): Promise<void> {
    try {
      const data = (action?.data ?? {}) as Record<string, any>;
      const packageHash: string | undefined = data.package;
      if (!packageHash) return;

      const coopname: string = data.coopname || config.coopname;
      // decision/act/link относятся к процессу (package), а не к конкретному заявлению.
      // Пересобираем агрегаты ВСЕХ заявлений пакета (их может быть несколько с разными
      // подписантами), сохраняя статус каждого.
      const rows = await this.repository.findByPackage(coopname, packageHash);
      if (rows.length === 0) return; // заявлений по пакету ещё нет — нечего дособирать

      let rebuilt = 0;
      for (const row of rows) {
        if (!row.sourceActionData) continue;
        await this.assembleAndUpsert(
          row.sourceActionData as unknown as IAction,
          row.status,
          coopname,
          row.doc_hash,
          row.hash,
          packageHash
        );
        rebuilt++;
      }
      if (rebuilt > 0) {
        this.logger.log(`[${label}] пересобрано агрегатов: ${rebuilt}, package=${this.shortPackage(action)}`);
      }
    } catch (error: any) {
      this.logger.warn(`Ошибка пересборки агрегата по событию ${label}: ${error?.message}`);
    }
  }

  private async assembleAndUpsert(
    sourceAction: IAction,
    status: SignedDocumentStatus,
    coopname: string,
    docHash: string,
    hash: string,
    packageHash: string
  ): Promise<void> {
    const aggregate = await this.buildAggregateSafe(sourceAction);
    const data = (sourceAction?.data ?? {}) as Record<string, any>;
    const statement = aggregate?.statement;
    const rawDoc = statement?.documentAggregate?.rawDocument;
    const meta = (rawDoc?.meta ?? {}) as Record<string, any>;

    await this.repository.upsert({
      coopname,
      packageHash,
      doc_hash: docHash,
      hash,
      username: meta.username || data.username || '',
      status,
      action: data.action || '',
      registry_id: typeof meta.registry_id === 'number' ? meta.registry_id : 0,
      full_title: rawDoc?.full_title || '',
      content_text: this.stripHtml(rawDoc?.html || ''),
      signers_text: this.collectSignersText(aggregate),
      block_num: this.resolveBlockNum(sourceAction?.block_num, meta.block_num),
      document_created_at: this.parseDocumentDate(meta.created_at, meta.timezone),
      document_aggregate: aggregate,
      source_action_data: sourceAction as unknown as Record<string, unknown>,
    });
  }

  private async buildAggregateSafe(action: IAction): Promise<DocumentPackageAggregateDomainInterface | null> {
    try {
      return await this.aggregator.buildDocumentPackageAggregate(action as unknown as Cooperative.Blockchain.IAction);
    } catch (error: any) {
      this.logger.debug(`Не удалось собрать агрегат пакета: ${error?.message}`);
      return null;
    }
  }

  /**
   * Собирает ФИО/наименования всех подписантов пакета из signer_certificate всех частей агрегата
   * (заявление/решение/акты/связанные). Это и есть основной индекс поиска по подписанту —
   * соподписанты (председатель/совет) подписывают решение и акты, а не тело заявления,
   * поэтому content_text их не покрывает. Username добавляется тоже (редкий поиск по нему).
   */
  private collectSignersText(aggregate: DocumentPackageAggregateDomainInterface | null): string {
    if (!aggregate) return '';

    const docAggregates = [
      aggregate.statement?.documentAggregate,
      aggregate.decision?.documentAggregate,
      ...aggregate.acts.map((act) => act?.documentAggregate),
      ...aggregate.links,
    ];

    const parts = new Set<string>();
    for (const da of docAggregates) {
      const signatures = da?.document?.signatures ?? [];
      for (const sig of signatures) {
        if (sig?.signer) parts.add(String(sig.signer));
        const cert = sig?.signer_certificate as Record<string, any> | null | undefined;
        if (!cert) continue;
        for (const key of ['last_name', 'first_name', 'middle_name', 'short_name']) {
          if (cert[key]) parts.add(String(cert[key]));
        }
      }
    }

    return Array.from(parts).join(' ');
  }

  private shortPackage(action: IAction): string {
    const pkg = (action?.data as Record<string, any>)?.package;
    return typeof pkg === 'string' ? pkg.substring(0, 8) : '?';
  }

  /**
   * Номер блока для колонки block_num — ось упорядочивания ВЕРСИЙ подписи одного doc_hash.
   * Это блок ON-CHAIN ДЕЙСТВИЯ (action.block_num), а НЕ блок генерации документа (meta.block_num):
   * guard'ы в ingestAction сравнивают пришедший action.block_num с хранимым block_num, поэтому обе
   * стороны должны мерить одну величину. Иначе (meta.block_num — блок генерации, всегда ≤ блока
   * подачи в цепь) защита от отката на старую версию и идемпотентность по блоку не срабатывают.
   * meta.block_num — только запасной вариант, если у действия нет block_num.
   */
  private resolveBlockNum(actionBlockNum: unknown, metaBlockNum: unknown): string | null {
    if (actionBlockNum !== undefined && actionBlockNum !== null) return String(actionBlockNum);
    if (metaBlockNum !== undefined && metaBlockNum !== null) return String(metaBlockNum);
    return null;
  }

  /**
   * Парсит meta.created_at в Date для колонки timestamptz. Документы хранят дату в
   * ЛОКАЛИЗОВАННОМ формате `DD.MM.YYYY HH:mm` + отдельное поле meta.timezone — именно так её
   * пишет фабрика @coopenomics/factory (Generator.updateMetadata через moment.tz). Нативный
   * `new Date(meta.created_at)` этот формат НЕ понимает и даёт Invalid Date → pg-драйвер пишет
   * в timestamptz "0NaN-NaN-NaN…" и вся вставка падает. Парсим тем же moment.tz, что и фабрика;
   * timezone берём из меты, иначе — из конфига кооператива. Невалидное/пустое значение → null
   * (одна битая дата не должна ронять запись и весь backfill).
   */
  private parseDocumentDate(createdAt: unknown, timezone: unknown): Date | null {
    if (!createdAt || typeof createdAt !== 'string') return null;
    const tz = typeof timezone === 'string' && timezone ? timezone : config.timezone;
    const parsed = moment.tz(createdAt, 'DD.MM.YYYY HH:mm', tz);
    return parsed.isValid() ? parsed.toDate() : null;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
