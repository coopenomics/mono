import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cooperative, SovietContract } from 'cooptypes';
import { DocumentPackageAggregator } from '~/domain/document/aggregators/document-package.aggregator';
import { packageParticipants } from '~/domain/document/services/document-package-visibility';
import {
  SIGNED_DOCUMENT_REPOSITORY,
  type SignedDocumentRepository,
} from '~/domain/document/repository/signed-document.repository';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import { SignedDocumentRole } from '~/domain/document/enums/signed-document-role.enum';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import config from '~/config/config';
import type { IAction } from '~/types/common';
import { parseCreatedAt } from '@coopenomics/docs-factory';

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
 *
 * Журнал документов (решение владельца 18.11.2026): строка на каждый подписанный документ.
 * Решение, акт и связанный документ получают свою строку с ролью (плоский вид, поиск, период),
 * а пакетный вид по-прежнему строится по строкам заявлений. Соглашение, которое заявление
 * перечисляет в meta.links (вступление), реестр записывает в пакет заявления с ролью
 * «соглашение», а не отдельным пакетом — при любом порядке событий заявления и соглашения.
 */
@Injectable()
export class SignedDocumentIngestionService {
  private readonly logger = new Logger(SignedDocumentIngestionService.name);

  constructor(
    @Inject(SIGNED_DOCUMENT_REPOSITORY) private readonly repository: SignedDocumentRepository,
    private readonly aggregator: DocumentPackageAggregator
  ) {}

  /**
   * Очередь обработки per-документ. make_complete_document шлёт newsubmitted+newresolved одной
   * транзакцией — оба листенера стартуют почти одновременно, оба читают getState «записи нет»,
   * и финальный статус решал случайный порядок upsert'ов (submitted перетирал resolved — документ
   * «зависал поданным»). Очередь в памяти достаточна: события шины слушает один процесс.
   */
  private readonly docChains = new Map<string, Promise<unknown>>();

  private enqueueByDoc<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.docChains.get(key) ?? Promise.resolve();
    const next = prev.then(fn);
    const tail = next.then(
      () => undefined,
      () => undefined
    );
    this.docChains.set(key, tail);
    void tail.then(() => {
      if (this.docChains.get(key) === tail) this.docChains.delete(key);
    });
    return next;
  }

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
    await this.safePart(action, SignedDocumentRole.Decision, Registry.NewDecision.actionName);
  }

  @OnEvent(`action::${SOVIET}::${Registry.NewAct.actionName}`)
  async onNewAct(action: IAction): Promise<void> {
    await this.safeReassemble(action, Registry.NewAct.actionName);
    await this.safePart(action, SignedDocumentRole.Act, Registry.NewAct.actionName);
  }

  @OnEvent(`action::${SOVIET}::${Registry.NewLink.actionName}`)
  async onNewLink(action: IAction): Promise<void> {
    await this.safeReassemble(action, Registry.NewLink.actionName);
    await this.safePart(action, SignedDocumentRole.Link, Registry.NewLink.actionName);
  }

  /**
   * Строка журнала для документа процесса — решения, акта, связанного документа.
   * Идемпотентно по doc_hash; строку заявления не перетирает (тот же документ бывает
   * заявлением одного процесса и связью другого — главным остаётся заявление).
   * Используется и листенерами шины, и разовым проходом журнала.
   */
  async ingestPart(action: IAction, role: SignedDocumentRole): Promise<IngestResult> {
    const data = (action?.data ?? {}) as Record<string, any>;
    const docHash: string | undefined = data.document?.doc_hash;
    const packageHash: string = data.package || '';
    if (!docHash || !packageHash) return 'skipped';
    const coopname: string = data.coopname || config.coopname;
    const incomingBlock = this.toBlockNum(action?.block_num);

    return this.enqueueByDoc(`${coopname}:${docHash}`, async () => {
      const existing = await this.repository.getState(coopname, docHash);
      if (existing) {
        if (existing.role === SignedDocumentRole.Statement || existing.role === SignedDocumentRole.Agreement) return 'skipped';
        if (incomingBlock === null || existing.blockNum === null || incomingBlock <= existing.blockNum) return 'skipped';
      }
      const full = await this.buildAggregateSafe(action);
      // В строке документа процесса — только сам документ; пакет целиком хранит строка заявления.
      const aggregate: DocumentPackageAggregateDomainInterface | null = full?.statement
        ? { statement: full.statement, decision: null, acts: [], links: [] }
        : null;
      await this.upsertRow({
        action,
        aggregate,
        status: SignedDocumentStatus.Resolved,
        coopname,
        docHash,
        hash: data.document?.hash || '',
        packageHash,
        role,
        links: [],
      });
      return existing ? 'updated' : 'created';
    });
  }

  private async safePart(action: IAction, role: SignedDocumentRole, label: string): Promise<void> {
    try {
      const result = await this.ingestPart(action, role);
      if (result !== 'skipped') this.logger.log(`[${label}] строка журнала ${result}: package=${this.shortPackage(action)}`);
    } catch (error: any) {
      this.logger.warn(`Ошибка записи документа процесса ${label}: ${error?.message}`);
    }
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

    return this.enqueueByDoc(`${coopname}:${docHash}`, () =>
      this.ingestActionExclusive(action, status, { coopname, docHash, hash, packageHash, incomingBlock })
    );
  }

  private async ingestActionExclusive(
    action: IAction,
    status: SignedDocumentStatus,
    ctx: { coopname: string; docHash: string; hash: string; packageHash: string; incomingBlock: number | null }
  ): Promise<IngestResult> {
    const { coopname, docHash, hash, packageHash, incomingBlock } = ctx;

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
      // Пакет собирают строки заявлений; документы процесса и соглашения своих пакетов не держат.
      const rows = (await this.repository.findByPackage(coopname, packageHash)).filter(
        (row) => row.role === SignedDocumentRole.Statement
      );
      if (rows.length === 0) return; // заявлений по пакету ещё нет — нечего дособирать

      let rebuilt = 0;
      for (const row of rows) {
        if (!row.sourceActionData) continue;
        await this.enqueueByDoc(`${coopname}:${row.doc_hash}`, async () => {
          // Статус перечитываем уже внутри очереди: параллельный newresolved мог успеть
          // повысить его, и пересборка со снапшотом row.status откатила бы документ назад.
          const fresh = await this.repository.getState(coopname, row.doc_hash);
          await this.assembleAndUpsert(
            row.sourceActionData as unknown as IAction,
            fresh?.status ?? row.status,
            coopname,
            row.doc_hash,
            row.hash,
            packageHash
          );
        });
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
    const meta = (aggregate?.statement?.documentAggregate?.rawDocument?.meta ?? {}) as Record<string, any>;
    const links: string[] = Array.isArray(meta.links) ? meta.links.map((link: unknown) => String(link)) : [];

    // Соглашение, которое заявление перечисляет в связях, живёт в пакете заявления.
    const linkingPackage = await this.repository.findLinkingPackage(coopname, docHash);
    const isAgreement = !!linkingPackage && linkingPackage !== packageHash;

    await this.upsertRow({
      action: sourceAction,
      aggregate,
      status,
      coopname,
      docHash,
      hash,
      packageHash: isAgreement ? linkingPackage : packageHash,
      role: isAgreement ? SignedDocumentRole.Agreement : SignedDocumentRole.Statement,
      links,
    });

    // Узел записал соглашения раньше заявления — переводим их в пакет заявления.
    if (!isAgreement && links.length > 0) {
      const moved = await this.repository.attachLinkedAgreements(coopname, packageHash, links);
      if (moved > 0) this.logger.log(`Соглашения заявления переведены в его пакет: ${moved}, package=${packageHash.substring(0, 8)}`);
    }
  }

  /** Строка журнала по готовому агрегату: поля поиска, участники, даты. */
  private async upsertRow(input: {
    action: IAction;
    aggregate: DocumentPackageAggregateDomainInterface | null;
    status: SignedDocumentStatus;
    coopname: string;
    docHash: string;
    hash: string;
    packageHash: string;
    role: SignedDocumentRole;
    links: string[];
  }): Promise<void> {
    const { action, aggregate } = input;
    const data = (action?.data ?? {}) as Record<string, any>;
    const rawDoc = aggregate?.statement?.documentAggregate?.rawDocument;
    const meta = (rawDoc?.meta ?? {}) as Record<string, any>;
    const owner = meta.username || data.username || '';
    const documentCreatedAt = this.parseDocumentDate(meta.created_at, meta.timezone);

    await this.repository.upsert({
      coopname: input.coopname,
      packageHash: input.packageHash,
      doc_hash: input.docHash,
      hash: input.hash,
      username: owner,
      status: input.status,
      action: data.action || '',
      registry_id: typeof meta.registry_id === 'number' ? meta.registry_id : 0,
      full_title: rawDoc?.full_title || '',
      content_text: this.stripHtml(rawDoc?.html || ''),
      signers_text: this.collectSignersText(aggregate),
      participants: packageParticipants(aggregate, owner),
      block_num: this.resolveBlockNum(action?.block_num, meta.block_num),
      document_created_at: documentCreatedAt,
      document_aggregate: aggregate,
      source_action_data: action as unknown as Record<string, unknown>,
      role: input.role,
      signed_at: this.blockTime(action) ?? documentCreatedAt,
      links: input.links,
    });
  }

  /** Время блока действия — дата подписи документа в цепи. */
  private blockTime(action: IAction): Date | null {
    const raw = (action as { block_time?: string | Date } | null)?.block_time;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
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
   * Парсит meta.created_at в Date для колонки timestamptz. Фабрика пишет дату в ISO 8601,
   * а документы до 28.09.2026 — в виде `DD.MM.YYYY HH:mm` в поясе meta.timezone; разбирает оба
   * вида сама фабрика (`parseCreatedAt`). Пояс берём из меты, иначе — из конфига кооператива.
   * Невалидное/пустое значение → null (одна битая дата не должна ронять запись и весь backfill).
   */
  private parseDocumentDate(createdAt: unknown, timezone: unknown): Date | null {
    if (!createdAt || typeof createdAt !== 'string') return null;
    const tz = typeof timezone === 'string' && timezone ? timezone : config.timezone;
    try {
      const parsed = parseCreatedAt(createdAt, tz);
      return parsed.isValid() ? parsed.toDate() : null;
    } catch {
      return null;
    }
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
