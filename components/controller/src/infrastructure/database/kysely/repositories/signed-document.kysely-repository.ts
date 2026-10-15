import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
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

const EMPTY_AGGREGATE: DocumentPackageAggregateDomainInterface = {
  statement: null,
  decision: null,
  acts: [],
  links: [],
};

const json = (value: unknown): string | null => (value == null ? null : JSON.stringify(value));

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
      block_num: input.block_num,
      document_created_at: input.document_created_at,
      document_aggregate: json(input.document_aggregate),
      source_action_data: json(input.source_action_data),
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
        updated_at: sql`now()`,
      })
      .where('coopname', '=', coopname)
      .where('doc_hash', '=', docHash)
      .execute();
  }

  async getState(coopname: string, docHash: string): Promise<SignedDocumentState | null> {
    const row = await this.db
      .selectFrom('signed_documents')
      .select(['status', 'block_num'])
      .where('coopname', '=', coopname)
      .where('doc_hash', '=', docHash)
      .executeTakeFirst();
    if (!row) return null;
    return { status: row.status as SignedDocumentStatus, blockNum: row.block_num != null ? Number(row.block_num) : null };
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
      .select(['doc_hash', 'hash', 'status', 'source_action_data'])
      .where('coopname', '=', coopname)
      .where('package', '=', packageHash)
      .execute();
    return rows.map((row) => ({
      doc_hash: row.doc_hash,
      hash: row.hash,
      status: row.status as SignedDocumentStatus,
      sourceActionData: (row.source_action_data as Record<string, unknown> | null) ?? null,
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
        // Чистое наименование из meta.title (как в реестре на главной), запасной вариант — full_title.
        full_title: this.extractTitle(aggregate, row.full_title),
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
    let query = this.db.selectFrom('signed_documents').where('coopname', '=', params.coopname);

    if (params.status) query = query.where('status', '=', params.status);
    if (params.actions && params.actions.length > 0) query = query.where('action', 'in', params.actions);
    if (params.username) query = query.where('username', '=', params.username);
    if (params.hash) {
      // Фронт шлёт хэш в верхнем регистре, в реестре он хранится как пришёл из агрегата — сверка без учёта регистра.
      query = query.where(sql<boolean>`upper(hash) = upper(${params.hash})`);
    }
    if (params.afterBlock !== undefined) query = query.where('block_num', '>=', String(params.afterBlock));
    if (params.beforeBlock !== undefined) query = query.where('block_num', '<=', String(params.beforeBlock));

    const rows = await query
      .select('document_aggregate')
      .orderBy('document_created_at', (order) => order.desc().nullsLast())
      .orderBy('created_at', 'desc')
      .offset((params.page - 1) * params.limit)
      .limit(params.limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();

    return {
      items: rows.map(
        (row) => (row.document_aggregate as unknown as DocumentPackageAggregateDomainInterface | null) ?? EMPTY_AGGREGATE
      ),
      total: Number(total.count),
    };
  }
}
