import { Inject, Injectable } from '@nestjs/common';
import { sql, type Selectable } from 'kysely';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { DomainError } from '@coopenomics/extension-kit';
import type { CandidateRepository } from '~/domain/account/repository/candidate.repository';
import type { CandidateDomainInterface } from '~/domain/account/interfaces/candidate-domain.interface';
import { DocumentType, ProgramKey, CandidateStatus } from '~/domain/registration/enum';
import type { Candidates } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';

/** Колонка документа кандидата по его виду. */
const DOCUMENT_COLUMN = {
  [DocumentType.STATEMENT]: 'statement',
  [DocumentType.WALLET_AGREEMENT]: 'wallet_agreement',
  [DocumentType.SIGNATURE_AGREEMENT]: 'signature_agreement',
  [DocumentType.PRIVACY_AGREEMENT]: 'privacy_agreement',
  [DocumentType.USER_AGREEMENT]: 'user_agreement',
  [DocumentType.BLAGOROST_OFFER]: 'blagorost_offer',
  [DocumentType.GENERATOR_OFFER]: 'generator_offer',
} as const;

const DOCUMENT_COLUMNS = Object.values(DOCUMENT_COLUMN);
const PLAIN_COLUMNS = ['status', 'registered_at', 'type', 'braname', 'registration_hash'] as const;

const json = (value: unknown): string | null => (value == null ? null : JSON.stringify(value));
const doc = (value: unknown): ISignedDocument | undefined => (value as ISignedDocument | null) ?? undefined;

/** Правятся только переданные поля; пустые значения поле не затирают. */
function changes(data: Partial<CandidateDomainInterface>): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const column of PLAIN_COLUMNS) {
    if (data[column]) set[column] = data[column];
  }
  if (data.program_key !== undefined) set.program_key = data.program_key;
  for (const column of DOCUMENT_COLUMNS) {
    if (data.documents?.[column]) set[column] = json(data.documents[column]);
  }
  // Соглашения программ дополняются, ответы на анкеты заменяются целиком:
  // повторная подача заявления — это новый набор ответов, а не дополнение прежнего.
  if (data.program_agreements) {
    set.program_agreements = sql`COALESCE(program_agreements, '{}'::jsonb) || ${json(data.program_agreements)}::jsonb`;
  }
  if (data.intake_answers) set.intake_answers = json(data.intake_answers);
  return set;
}

function toDomain(row: Selectable<Candidates>): CandidateDomainInterface {
  return {
    username: row.username,
    coopname: row.coopname,
    braname: row.braname as string,
    status: row.status as CandidateStatus,
    type: row.type as CandidateDomainInterface['type'],
    created_at: row.created_at,
    registered_at: row.registered_at ?? undefined,
    documents: {
      statement: doc(row.statement),
      wallet_agreement: doc(row.wallet_agreement),
      signature_agreement: doc(row.signature_agreement),
      privacy_agreement: doc(row.privacy_agreement),
      user_agreement: doc(row.user_agreement),
      blagorost_offer: doc(row.blagorost_offer),
      generator_offer: doc(row.generator_offer),
    },
    registration_hash: row.registration_hash,
    referer: row.referer ?? undefined,
    public_key: row.public_key,
    meta: row.meta ?? undefined,
    program_key: (row.program_key ?? undefined) as ProgramKey | undefined,
    program_agreements: (row.program_agreements as unknown as CandidateDomainInterface['program_agreements']) ?? {},
    intake_answers: (row.intake_answers as unknown as CandidateDomainInterface['intake_answers']) ?? {},
  };
}

/** Кандидаты в пайщики: заявление и документы до приёма (таблица `candidates`). */
@Injectable()
export class CandidateKyselyRepository implements CandidateRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async findByUsername(username: string): Promise<CandidateDomainInterface | null> {
    const row = await this.db.selectFrom('candidates').selectAll().where('username', '=', username).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async findByRegistrationHash(hash: string): Promise<CandidateDomainInterface | null> {
    // В базе хэш регистрации лежит строчными буквами, из цепи приходит заглавными.
    const row = await this.db
      .selectFrom('candidates')
      .selectAll()
      .where('registration_hash', '=', hash.toLowerCase())
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async create(data: CandidateDomainInterface): Promise<CandidateDomainInterface> {
    const values = {
      username: data.username,
      coopname: data.coopname,
      braname: data.braname || '',
      status: data.status,
      type: data.type,
      created_at: data.created_at,
      registration_hash: data.registration_hash,
      referer: data.referer ?? null,
      public_key: data.public_key,
      meta: data.meta ?? null,
      program_key: data.program_key ?? null,
      program_agreements: JSON.stringify(data.program_agreements ?? {}),
      intake_answers: JSON.stringify(data.intake_answers ?? {}),
    };
    // Повторная регистрация с тем же именем перезаписывает заявку, как и прежде.
    const row = await this.db
      .insertInto('candidates')
      .values(values)
      .onConflict((conflict) => conflict.column('username').doUpdateSet(values))
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async update(username: string, data: Partial<CandidateDomainInterface>): Promise<CandidateDomainInterface | null> {
    const set = changes(data);
    if (Object.keys(set).length === 0) return this.findByUsername(username);
    const row = await this.db.updateTable('candidates').set(set).where('username', '=', username).returningAll().executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  async saveDocument(username: string, documentType: DocumentType, document: ISignedDocument): Promise<void> {
    const row = await this.db
      .updateTable('candidates')
      .set({ [DOCUMENT_COLUMN[documentType]]: json(document) })
      .where('username', '=', username)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw DomainError.notFound('DATABASE_CANDIDATE_NOT_FOUND', { username });
  }

  async saveProgramAgreement(username: string, agreementId: string, document: ISignedDocument): Promise<void> {
    const row = await this.db
      .updateTable('candidates')
      .set({
        program_agreements: sql`COALESCE(program_agreements, '{}'::jsonb) || ${JSON.stringify({ [agreementId]: document })}::jsonb`,
      })
      .where('username', '=', username)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw DomainError.notFound('DATABASE_CANDIDATE_NOT_FOUND', { username });
  }

  /** Кандидаты по дате приёма; не принятые — в конце при убывании и в начале при возрастании. */
  async findAllPaginated(options: {
    page: number;
    limit: number;
    sortOrder: 'ASC' | 'DESC';
    referer?: string;
  }): Promise<{ items: CandidateDomainInterface[]; totalCount: number }> {
    let query = this.db.selectFrom('candidates');
    if (options.referer) query = query.where('referer', '=', options.referer);
    const descending = options.sortOrder === 'DESC';

    const rows = await query
      .selectAll()
      .orderBy('registered_at', (ob) => (descending ? ob.desc().nullsLast() : ob.asc().nullsFirst()))
      .orderBy('created_at', descending ? 'desc' : 'asc')
      .offset((options.page - 1) * options.limit)
      .limit(options.limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    return { items: rows.map(toDomain), totalCount: Number(total.count) };
  }
}
