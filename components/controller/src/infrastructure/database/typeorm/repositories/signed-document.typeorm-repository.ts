import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignedDocumentEntity } from '../entities/signed-document.entity';
import { SignedDocumentStatus } from '~/domain/document/enums/signed-document-status.enum';
import type { DocumentPackageAggregateDomainInterface } from '~/domain/document/interfaces/document-package-aggregate-domain.interface';
import type {
  SignedDocumentListParams,
  SignedDocumentListResult,
  SignedDocumentPackageRow,
  SignedDocumentRepository,
  SignedDocumentSearchHit,
  SignedDocumentSearchParams,
  SignedDocumentState,
  SignedDocumentUpsertInput,
} from '~/domain/document/repository/signed-document.repository';

const EMPTY_AGGREGATE: DocumentPackageAggregateDomainInterface = {
  statement: null,
  decision: null,
  acts: [],
  links: [],
};

/**
 * Реализация репозитория реестра подписанных документов на базе TypeORM.
 */
@Injectable()
export class SignedDocumentTypeormRepository implements SignedDocumentRepository {
  constructor(
    @InjectRepository(SignedDocumentEntity)
    private readonly repository: Repository<SignedDocumentEntity>
  ) {}

  async upsert(input: SignedDocumentUpsertInput): Promise<void> {
    const existing = await this.repository.findOne({
      where: { coopname: input.coopname, doc_hash: input.doc_hash },
    });

    if (existing) {
      this.repository.merge(existing, this.toColumns(input));
      await this.repository.save(existing);
      return;
    }

    await this.repository.save(this.repository.create(this.toColumns(input)));
  }

  async getState(coopname: string, docHash: string): Promise<SignedDocumentState | null> {
    const entity = await this.repository.findOne({
      where: { coopname, doc_hash: docHash },
      select: ['status', 'block_num'],
    });
    if (!entity) return null;
    return { status: entity.status, blockNum: entity.block_num != null ? Number(entity.block_num) : null };
  }

  async count(coopname: string): Promise<number> {
    return this.repository.count({ where: { coopname } });
  }

  async findByPackage(coopname: string, packageHash: string): Promise<SignedDocumentPackageRow[]> {
    const rows = await this.repository.find({
      where: { coopname, packageHash },
      select: ['doc_hash', 'hash', 'status', 'source_action_data'],
    });
    return rows.map((row) => ({
      doc_hash: row.doc_hash,
      hash: row.hash,
      status: row.status,
      sourceActionData: row.source_action_data ?? null,
    }));
  }

  async search(params: SignedDocumentSearchParams): Promise<SignedDocumentSearchHit[]> {
    const qb = this.repository.createQueryBuilder('d').where('d.coopname = :coopname', { coopname: params.coopname });

    // Скоуп по пайщику: не-член совета ищет только в своих документах (см. SearchResolver).
    if (params.username) {
      qb.andWhere('d.username = :username', { username: params.username });
    }

    const query = params.query?.trim();
    if (query) {
      qb.andWhere(
        '(d.signers_text ILIKE :q OR d.full_title ILIKE :q OR d.content_text ILIKE :q OR d.username ILIKE :q)',
        { q: `%${query}%` }
      );
    }

    qb.orderBy('d.document_created_at', 'DESC', 'NULLS LAST').limit(params.limit);

    const rows = await qb.getMany();

    return rows.map((row) => ({
      hash: row.hash,
      // Чистое наименование из meta.title (как в реестре на главной), запасной вариант — full_title.
      full_title: this.extractTitle(row.document_aggregate, row.full_title),
      username: row.username,
      signer: this.extractSignerFio(row.document_aggregate, row.username),
      coopname: row.coopname,
      registry_id: row.registry_id,
      created_at: row.document_created_at ? row.document_created_at.toISOString() : null,
      highlights: [],
    }));
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
      return [cert.last_name, cert.first_name, cert.middle_name].filter(Boolean).join(' ');
    }
    return '';
  }

  async findAggregates(params: SignedDocumentListParams): Promise<SignedDocumentListResult> {
    const qb = this.repository.createQueryBuilder('d').where('d.coopname = :coopname', { coopname: params.coopname });

    if (params.status) {
      qb.andWhere('d.status = :status', { status: params.status });
    }
    if (params.actions && params.actions.length > 0) {
      qb.andWhere('d.action IN (:...actions)', { actions: params.actions });
    }
    if (params.username) {
      qb.andWhere('d.username = :username', { username: params.username });
    }
    if (params.hash) {
      // Фронт шлёт хэш в upper-case, в реестре он хранится как пришёл из агрегата — сверяем регистронезависимо.
      qb.andWhere('UPPER(d.hash) = UPPER(:hash)', { hash: params.hash });
    }
    if (params.afterBlock !== undefined) {
      qb.andWhere('d.block_num IS NOT NULL AND d.block_num >= :afterBlock', { afterBlock: params.afterBlock });
    }
    if (params.beforeBlock !== undefined) {
      qb.andWhere('d.block_num IS NOT NULL AND d.block_num <= :beforeBlock', { beforeBlock: params.beforeBlock });
    }

    qb.orderBy('d.document_created_at', 'DESC', 'NULLS LAST').addOrderBy('d.created_at', 'DESC');
    qb.skip((params.page - 1) * params.limit).take(params.limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      items: rows.map((row) => row.document_aggregate ?? EMPTY_AGGREGATE),
      total,
    };
  }

  private toColumns(input: SignedDocumentUpsertInput): Partial<SignedDocumentEntity> {
    return {
      coopname: input.coopname,
      packageHash: input.packageHash,
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
      document_aggregate: input.document_aggregate,
      source_action_data: input.source_action_data,
    };
  }
}
