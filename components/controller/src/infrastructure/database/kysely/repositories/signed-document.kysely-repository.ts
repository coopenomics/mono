import { Inject, Injectable } from '@nestjs/common';
import { sql, type SelectQueryBuilder } from 'kysely';
import { affectedCount } from '@coopenomics/extension-kit';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import { SignedDocumentRole } from '~/domain/document/enums/signed-document-role.enum';
import { documentTitle } from '~/domain/document/services/document-title';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import { personFullName } from '~/shared/utils/person-name';
import type {
  SignedDocumentAggregateUpdate,
  SignedDocumentListParams,
  SignedDocumentListResult,
  SignedDocumentPackageRow,
  SignedDocumentRepository,
  SignedDocumentSearchHit,
  SignedDocumentSearchParams,
  SignedDocumentState,
  SignedDocumentUpsertInput,
} from '~/domain/document/repository/signed-document.repository';
import { KYSELY, type Database } from '../kysely.tokens';
import type { DB } from '../database.types';

const EMPTY_AGGREGATE: DocumentPackageAggregateDomainInterface = {
  statement: null,
  decision: null,
  acts: [],
  links: [],
};

const json = (value: unknown): string | null => (value == null ? null : JSON.stringify(value));

/** Выборка строк журнала до select — общая основа списка и подсчёта. */
type ListQuery = SelectQueryBuilder<DB, 'signed_documents', object>;

/**
 * Реестр подписанных документов (таблица `signed_documents`): одна строка на
 * документ, уникальность по хэшу содержимого `doc_hash`. Колонка `package` —
 * идентификатор процесса, в который входит документ.
 */
@Injectable()
export class SignedDocumentKyselyRepository implements SignedDocumentRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async upsert(input: SignedDocumentUpsertInput): Promise<void> {
    const values = {
      coopname: input.coopname,
      package: input.packageHash,
      doc_hash: input.doc_hash,
      hash: input.hash,
      username: input.username,
      status: input.status,
      action: input.action,
      registry_id: input.registry_id,
      full_title: input.full_title,
      content_text: input.content_text,
      signers_text: input.signers_text,
      participants: input.participants,
      block_num: input.block_num,
      document_created_at: input.document_created_at,
      document_aggregate: json(input.document_aggregate),
      source_action_data: json(input.source_action_data),
      role: input.role,
      signed_at: input.signed_at,
      links: input.links.map((link) => link.toUpperCase()),
    };
    await this.db
      .insertInto('signed_documents')
      .values(values)
      .onConflict((conflict) => conflict.columns(['coopname', 'doc_hash']).doUpdateSet({ ...values, updated_at: sql`now()` }))
      .execute();
  }

  async updateAggregate(coopname: string, docHash: string, fields: SignedDocumentAggregateUpdate): Promise<void> {
    // Точечная правка только колонок, производных от агрегата: статус, версия и источник не
    // перетираются (защита от отката resolved→submitted при пересборке, конкурентной со статус-событием).
    await this.db
      .updateTable('signed_documents')
      .set({
        document_aggregate: json(fields.document_aggregate),
        full_title: fields.full_title,
        content_text: fields.content_text,
        signers_text: fields.signers_text,
        participants: fields.participants,
        updated_at: sql`now()`,
      })
      .where('coopname', '=', coopname)
      .where('doc_hash', '=', docHash)
      .execute();
  }

  async getState(coopname: string, docHash: string): Promise<SignedDocumentState | null> {
    const row = await this.db
      .selectFrom('signed_documents')
      .select(['status', 'block_num', 'role'])
      .where('coopname', '=', coopname)
      .where('doc_hash', '=', docHash)
      .executeTakeFirst();
    if (!row) return null;
    return {
      status: row.status as SignedDocumentStatus,
      blockNum: row.block_num != null ? Number(row.block_num) : null,
      role: row.role as SignedDocumentRole,
    };
  }

  async count(coopname: string): Promise<number> {
    const row = await this.db
      .selectFrom('signed_documents')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('coopname', '=', coopname)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async findByPackage(coopname: string, packageHash: string): Promise<SignedDocumentPackageRow[]> {
    const rows = await this.db
      .selectFrom('signed_documents')
      .select(['doc_hash', 'hash', 'status', 'source_action_data', 'role'])
      .where('coopname', '=', coopname)
      .where('package', '=', packageHash)
      .execute();
    return rows.map((row) => ({
      doc_hash: row.doc_hash,
      hash: row.hash,
      status: row.status as SignedDocumentStatus,
      sourceActionData: (row.source_action_data as Record<string, unknown> | null) ?? null,
      role: row.role as SignedDocumentRole,
    }));
  }

  async search(params: SignedDocumentSearchParams): Promise<SignedDocumentSearchHit[]> {
    let query = this.db.selectFrom('signed_documents').selectAll().where('coopname', '=', params.coopname);

    // Скоуп по пайщику: не-член совета ищет только в своих документах (см. SearchResolver).
    if (params.username) query = query.where('username', '=', params.username);

    const text = params.query?.trim();
    if (text) {
      const pattern = `%${text}%`;
      query = query.where((eb) =>
        eb.or([
          eb('signers_text', 'ilike', pattern),
          eb('full_title', 'ilike', pattern),
          eb('content_text', 'ilike', pattern),
          eb('username', 'ilike', pattern),
        ])
      );
    }

    const rows = await query
      .orderBy('document_created_at', (order) => order.desc().nullsLast())
      .limit(params.limit)
      .execute();

    return rows.map((row) => {
      const aggregate = row.document_aggregate as unknown as DocumentPackageAggregateDomainInterface | null;
      return {
        hash: row.hash,
        // Название по типу документа (текущая редакция шаблона); запасное — meta.title и full_title.
        full_title: documentTitle(row.registry_id, this.extractTitle(aggregate, row.full_title)),
        username: row.username,
        signer: this.extractSignerFio(aggregate, row.username),
        coopname: row.coopname,
        registry_id: row.registry_id,
        created_at: row.document_created_at ? row.document_created_at.toISOString() : null,
        highlights: [],
      };
    });
  }

  /** Наименование документа из meta.title готового агрегата; fallback — сохранённый full_title. */
  private extractTitle(
    aggregate: DocumentPackageAggregateDomainInterface | null,
    fallback: string
  ): string {
    const meta = aggregate?.statement?.documentAggregate?.document?.meta as Record<string, any> | undefined;
    const title = typeof meta?.title === 'string' ? meta.title : '';
    return title || fallback || '';
  }

  /**
   * ФИО подписанта-субъекта для выдачи поиска (вместо username). Берём подпись самого субъекта
   * (signer === username), иначе — первую; из её signer_certificate собираем «Фамилия Имя Отчество»
   * (для организации — short_name). Источник тот же, что у чипов подписей в реестре на главной.
   */
  private extractSignerFio(
    aggregate: DocumentPackageAggregateDomainInterface | null,
    username: string
  ): string {
    const signatures = aggregate?.statement?.documentAggregate?.document?.signatures ?? [];
    const signature = signatures.find((s) => s?.signer === username) ?? signatures[0];
    const cert = signature?.signer_certificate;
    if (!cert) return '';
    if ('short_name' in cert && cert.short_name) return String(cert.short_name);
    if ('last_name' in cert) {
      return personFullName(cert);
    }
    return '';
  }

  async findAggregates(params: SignedDocumentListParams): Promise<SignedDocumentListResult> {
    const base = this.db.selectFrom('signed_documents').where('coopname', '=', params.coopname);
    const query = this.withScope(this.withJournalFilters(base, params), params);

    const rows = await query
      .select(['document_aggregate', 'username', 'hash', 'registry_id', 'full_title', 'role', 'signed_at'])
      .orderBy('signed_at', (order) => order.desc().nullsLast())
      .orderBy('created_at', 'desc')
      .offset((params.page - 1) * params.limit)
      .limit(params.limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();

    return {
      items: rows.map(
        (row) => (row.document_aggregate as unknown as DocumentPackageAggregateDomainInterface | null) ?? EMPTY_AGGREGATE
      ),
      owners: rows.map((row) => row.username),
      hashes: rows.map((row) => row.hash),
      rows: rows.map((row) => ({
        registry_id: row.registry_id,
        full_title: row.full_title,
        role: row.role as SignedDocumentRole,
        signed_at: row.signed_at ? new Date(row.signed_at) : null,
      })),
      total: Number(total.count),
    };
  }

  /** Вид выдачи и фильтры журнала: роли строк, период подписи, тип документа, текст. */
  private withJournalFilters(query: ListQuery, params: SignedDocumentListParams): ListQuery {
    let next = query;
    // Пакетный вид — строки заявлений; поиск по хэшу находит документ любой роли.
    if (!params.hash) next = next.where('role', 'in', params.roles?.length ? params.roles : [SignedDocumentRole.Statement]);
    if (params.signedFrom) next = next.where('signed_at', '>=', params.signedFrom);
    if (params.signedTo) next = next.where('signed_at', '<=', params.signedTo);
    if (params.registryIds?.length) next = next.where('registry_id', 'in', params.registryIds);
    const text = params.query?.trim();
    if (!text) return next;
    const pattern = `%${text}%`;
    return next.where((eb) =>
      eb.or([
        eb('full_title', 'ilike', pattern),
        eb('signers_text', 'ilike', pattern),
        eb('content_text', 'ilike', pattern),
        eb('username', 'ilike', pattern),
      ])
    );
  }

  /** Охват выдачи: статус, действие, пайщик, документ, пакет, диапазон блоков. */
  private withScope(query: ListQuery, params: SignedDocumentListParams): ListQuery {
    let next = query;
    if (params.status) next = next.where('status', '=', params.status);
    if (params.actions && params.actions.length > 0) next = next.where('action', 'in', params.actions);
    if (params.username) {
      // Пакеты пайщика: он владелец заявления либо субъект или подписант
      // документа пакета (участник). Состав чужого пакета режет выдача —
      // `packageVisibleTo` в интеракторе реестра.
      const username = params.username;
      next = next.where((eb) =>
        eb.or([eb('username', '=', username), sql<boolean>`${sql.ref('participants')} @> ARRAY[${username}]::text[]`])
      );
    }
    // Стол шлёт хэш в верхнем регистре, реестр хранит его в регистре агрегата — сверка без учёта регистра.
    if (params.hash) next = next.where(sql<boolean>`upper(hash) = upper(${params.hash})`);
    // Пакет — хэш процесса: история операций учёта знает его, а хэш самого документа — нет.
    if (params.package) next = next.where(sql<boolean>`upper(package) = upper(${params.package})`);
    if (params.afterBlock != null) next = next.where('block_num', '>=', String(params.afterBlock));
    if (params.beforeBlock != null) next = next.where('block_num', '<=', String(params.beforeBlock));
    return next;
  }

  async findLinkingPackage(coopname: string, docHash: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('signed_documents')
      .select(['package'])
      .where('coopname', '=', coopname)
      .where('role', '=', SignedDocumentRole.Statement)
      .where(sql<boolean>`${sql.ref('links')} @> ARRAY[${docHash.toUpperCase()}]::text[]`)
      .orderBy('block_num', 'desc')
      .limit(1)
      .executeTakeFirst();
    return row?.package ?? null;
  }

  async attachLinkedAgreements(coopname: string, packageHash: string, docHashes: string[]): Promise<number> {
    if (docHashes.length === 0) return 0;
    const hashes = docHashes.map((hash) => hash.toUpperCase());
    // Только отдельные пакеты соглашений: строка-заявление со своим пакетом.
    const result = await this.db
      .updateTable('signed_documents')
      .set({ package: packageHash, role: SignedDocumentRole.Agreement, updated_at: sql`now()` })
      .where('coopname', '=', coopname)
      .where('role', '=', SignedDocumentRole.Statement)
      .where('package', '!=', packageHash)
      .where(sql<boolean>`upper(doc_hash) = ANY(${hashes}::text[])`)
      .execute();
    return affectedCount(result);
  }

  async countParts(coopname: string): Promise<number> {
    const row = await this.db
      .selectFrom('signed_documents')
      .select((eb) => eb.fn.countAll<string>().as('count'))
      .where('coopname', '=', coopname)
      .where('role', '!=', SignedDocumentRole.Statement)
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}
