import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { KYSELY } from '@coopenomics/extension-kit';
import type { InnerPowerOfAttorneyType } from '@coopenomics/innercoop';
import type { PowerOfAttorneyRow } from '../../domain/powers-of-attorney/power-of-attorney';

const TABLE = 'ku_powers_of_attorney';
const LIABILITIES = 'ku_trustee_liabilities';

/** Новая доверенность по событию подписи доверенным лицом. */
export interface NewPowerOfAttorney {
  coopname: string;
  number: number;
  type: InnerPowerOfAttorneyType;
  registry_id: number;
  braname: string;
  holder: string;
  document_hash: string;
  source_hash: string | null;
  document: object;
  protocol_number: string;
  protocol_date: string;
  issued_at: string;
  valid_until: string;
  signed_at: Date;
}

/** Отбор реестра доверенностей. */
export interface PowerOfAttorneyListFilter {
  coopname: string;
  braname?: string;
  holder?: string;
  type?: InnerPowerOfAttorneyType;
}

/** Основание доверенности председателя участка — решение совета об учреждении участка. */
export interface BranchEstablishment {
  braname: string;
  branch_name: string;
  address: string;
  authorization: Record<string, unknown> | null;
}

/**
 * Учёт доверенностей кооператива. Строки пишут события цепи; состояние
 * «срок истёк» не хранится — его даёт `valid_until`.
 */
@Injectable()
export class KuPowerOfAttorneyKyselyRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(@Inject(KYSELY) private readonly db: Kysely<any>) {}

  /** Следующий сквозной номер доверенности в кооперативе. */
  async nextNumber(coopname: string): Promise<number> {
    const row = await this.db
      .selectFrom(TABLE)
      .select(sql<number>`coalesce(max(number), 0)`.as('max'))
      .where('coopname', '=', coopname)
      .executeTakeFirst();
    return Number(row?.max ?? 0) + 1;
  }

  /** Записывает доверенность; повтор события той же доверенности ничего не меняет. */
  async insertPending(row: NewPowerOfAttorney): Promise<void> {
    await this.db
      .insertInto(TABLE)
      .values({ ...row, document: JSON.stringify(row.document), status: 'pending' })
      .onConflict((oc) => oc.column('document_hash').doNothing())
      .execute();
  }

  /** Встречная подпись или отказ по хэшу документа. */
  async resolveByDocument(documentHash: string, status: 'active' | 'declined', countersigned: object | null, at: Date): Promise<number> {
    const result = await this.db
      .updateTable(TABLE)
      .set({ status, resolved_at: at, countersigned: countersigned ? JSON.stringify(countersigned) : null })
      .where(sql<boolean>`upper(document_hash) = upper(${documentHash})`)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0);
  }

  /** Встречная подпись или отказ по заявке (доверенное лицо: якорь — хэш заявки). */
  async resolveBySource(sourceHash: string, status: 'active' | 'declined', countersigned: object | null, at: Date): Promise<number> {
    const result = await this.db
      .updateTable(TABLE)
      .set({ status, resolved_at: at, countersigned: countersigned ? JSON.stringify(countersigned) : null })
      .where(sql<boolean>`upper(source_hash) = upper(${sourceHash})`)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    return Number(result.numUpdatedRows ?? 0);
  }

  /** Доверенности пайщика по участку и типу — новые первыми. */
  async findForHolder(coopname: string, braname: string, holder: string, type: InnerPowerOfAttorneyType): Promise<PowerOfAttorneyRow[]> {
    const rows = await this.db
      .selectFrom(TABLE)
      .selectAll()
      .where('coopname', '=', coopname)
      .where('braname', '=', braname)
      .where('holder', '=', holder)
      .where('type', '=', type)
      .orderBy('number', 'desc')
      .execute();
    return rows.map(toRow);
  }

  /** Реестр доверенностей с отбором и страницами — новые первыми. */
  async list(filter: PowerOfAttorneyListFilter, limit: number, offset: number): Promise<{ rows: PowerOfAttorneyRow[]; total: number }> {
    let query = this.db.selectFrom(TABLE).where('coopname', '=', filter.coopname);
    if (filter.braname) query = query.where('braname', '=', filter.braname);
    if (filter.holder) query = query.where('holder', '=', filter.holder);
    if (filter.type) query = query.where('type', '=', filter.type);
    const [rows, count] = await Promise.all([
      query.selectAll().orderBy('number', 'desc').limit(limit).offset(offset).execute(),
      query.select(sql<number>`count(*)`.as('n')).executeTakeFirst(),
    ]);
    return { rows: rows.map(toRow), total: Number(count?.n ?? 0) };
  }

  /**
   * Последняя встречно подписанная доверенность на каждую пару «участок —
   * пайщик — тип» кооператива. По ней узел решает, закрыты ли полномочия и
   * пора ли продлевать. Выборка по индексу кооператива, одна строка на пару.
   */
  async latestActive(coopname: string): Promise<PowerOfAttorneyRow[]> {
    const rows = await this.db
      .selectFrom(TABLE)
      .selectAll()
      .distinctOn(['braname', 'holder', 'type'])
      .where('coopname', '=', coopname)
      .where('status', '=', 'active')
      .orderBy('braname')
      .orderBy('holder')
      .orderBy('type')
      .orderBy('valid_until', 'desc')
      .execute();
    return rows.map(toRow);
  }

  /** Ожидает ли встречной подписи более новая доверенность пайщика (продление подано). */
  async hasPendingNewer(row: PowerOfAttorneyRow): Promise<boolean> {
    const found = await this.db
      .selectFrom(TABLE)
      .select('id')
      .where('coopname', '=', row.coopname)
      .where('braname', '=', row.braname)
      .where('holder', '=', row.holder)
      .where('type', '=', row.type)
      .where('status', '=', 'pending')
      .where('number', '>', row.number)
      .executeTakeFirst();
    return Boolean(found);
  }

  async markRenewalNotified(id: number, at: Date): Promise<void> {
    await this.db.updateTable(TABLE).set({ renewal_notified_at: at }).where('id', '=', id).execute();
  }

  // ── Договор о полной материальной ответственности председателя участка ──

  /** Договор по событию подписи председателем участка; повтор события ничего не меняет. */
  async insertLiability(row: { coopname: string; braname: string; holder: string; document_hash: string; document: object; signed_at: Date }): Promise<void> {
    await this.db
      .insertInto(LIABILITIES)
      .values({ ...row, document: JSON.stringify(row.document), status: 'pending' })
      .onConflict((oc) => oc.column('document_hash').doNothing())
      .execute();
  }

  /** Встречная подпись председателя совета или отказ по хэшу договора. */
  async resolveLiability(documentHash: string, status: 'approved' | 'declined', countersigned: object | null, at: Date): Promise<void> {
    await this.db
      .updateTable(LIABILITIES)
      .set({ status, resolved_at: at, countersigned: countersigned ? JSON.stringify(countersigned) : null })
      .where(sql<boolean>`upper(document_hash) = upper(${documentHash})`)
      .where('status', '=', 'pending')
      .execute();
  }

  /** Состояния договоров председателя по участку — новые первыми. */
  async liabilityStatuses(coopname: string, braname: string, holder: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom(LIABILITIES)
      .select('status')
      .where('coopname', '=', coopname)
      .where('braname', '=', braname)
      .where('holder', '=', holder)
      .orderBy('id', 'desc')
      .execute();
    return rows.map((r) => String(r.status));
  }

  /**
   * Договор для показа: подписанный обеими сторонами, а без него — последний
   * (на подписи или отклонённый). Документ — со встречной подписью, если она есть.
   */
  async liabilityDocument(coopname: string, braname: string, holder: string): Promise<Record<string, unknown> | null> {
    const row = await this.db
      .selectFrom(LIABILITIES)
      .select(['document', 'countersigned'])
      .where('coopname', '=', coopname)
      .where('braname', '=', braname)
      .where('holder', '=', holder)
      .orderBy(sql`case when status = 'approved' then 0 else 1 end`)
      .orderBy('id', 'desc')
      .executeTakeFirst();
    if (!row) return null;
    return parseJson(row.countersigned) ?? parseJson(row.document);
  }

  /** Решение совета об учреждении участка: название, адрес и документ протокола. */
  async findEstablishment(coopname: string, braname: string): Promise<BranchEstablishment | null> {
    const row = await this.db
      .selectFrom('ku_decisions')
      .select(['braname', 'branch_name', 'address', 'authorization'])
      .where('coopname', '=', coopname)
      .where('braname', '=', braname)
      .where('type', '=', 'createbranch')
      .where('authorization', 'is not', null)
      .orderBy('_updated_at', 'desc')
      .executeTakeFirst();
    if (!row) return null;
    return {
      braname: row.braname,
      branch_name: row.branch_name || row.braname,
      address: row.address ?? '',
      authorization: parseJson(row.authorization),
    };
  }
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value as Record<string, unknown>;
}

/**
 * Дата из базы → YYYY-MM-DD. Драйвер pg отдаёт тип `date` полночью по
 * местному времени процесса — дату берём по местным полям, без сдвига в UTC.
 */
function isoDate(value: unknown): string {
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  return String(value ?? '').slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(r: any): PowerOfAttorneyRow {
  return {
    id: Number(r.id),
    coopname: r.coopname,
    number: Number(r.number),
    type: r.type,
    registry_id: Number(r.registry_id),
    braname: r.braname,
    holder: r.holder,
    document_hash: r.document_hash,
    source_hash: r.source_hash ?? null,
    document: parseJson(r.document) ?? {},
    countersigned: parseJson(r.countersigned),
    protocol_number: r.protocol_number,
    protocol_date: r.protocol_date,
    issued_at: isoDate(r.issued_at),
    valid_until: isoDate(r.valid_until),
    status: r.status,
    signed_at: new Date(r.signed_at),
    resolved_at: r.resolved_at ? new Date(r.resolved_at) : null,
    renewal_notified_at: r.renewal_notified_at ? new Date(r.renewal_notified_at) : null,
  };
}
