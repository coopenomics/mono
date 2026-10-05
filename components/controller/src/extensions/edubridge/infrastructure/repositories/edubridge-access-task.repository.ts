import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { TableStore, inTransaction, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_ACCESS_TASK_STORE } from '../database/edubridge-stores';
import { EduAccessTaskStatus } from '../../domain/enums';
import { EdubridgeAccessTaskEntity } from '../entities';

@Injectable()
export class EdubridgeAccessTaskRepository {
  constructor(
    @Inject(EDUBRIDGE_ACCESS_TASK_STORE)
    private readonly repo: TableStore<EdubridgeAccessTaskEntity>
  ) {}

  /** Создать задачу; дубль по `(kind, enrollment_id, trigger_trx)` молча игнорируется — идемпотентность. */
  async enqueue(data: Partial<EdubridgeAccessTaskEntity>): Promise<EdubridgeAccessTaskEntity | null> {
    const { recipient_override, ...fields } = data;
    const rows = await this.repo.kysely
      .insertInto(this.repo.table)
      .values({
        ...fields,
        // json-колонка: шлюз сериализует её сам, собственный запрос — руками.
        ...(recipient_override === undefined ? {} : { recipient_override: recipient_override === null ? null : JSON.stringify(recipient_override) }),
        status: EduAccessTaskStatus.PENDING,
        attempts: 0,
        next_attempt_at: data.next_attempt_at ?? new Date(),
      })
      .onConflict((conflict) => conflict.doNothing())
      .returningAll()
      .execute();
    return this.repo.records(rows)[0] ?? null;
  }

  /**
   * Забрать пачку задач к исполнению. `FOR UPDATE SKIP LOCKED` — два экземпляра
   * контроллера не возьмут одну задачу; пометка RUNNING — в той же транзакции.
   */
  async claimDue(coopname: string, limit: number): Promise<EdubridgeAccessTaskEntity[]> {
    return inTransaction(this.repo.kysely, async (trx) => {
      const store = this.repo.on(trx);
      const found = await store
        .select()
        .where('coopname', '=', coopname)
        .where('status', '=', EduAccessTaskStatus.PENDING)
        .where('next_attempt_at', '<=', sql<Date>`now()`)
        .orderBy('next_attempt_at', 'asc')
        .limit(limit)
        .forUpdate()
        .skipLocked()
        .execute();
      const rows = store.records(found);
      if (!rows.length) return [];
      await store.update({ id: oneOf(rows.map((r) => r.id)) }, { status: EduAccessTaskStatus.RUNNING });
      return rows.map((r) => ({ ...r, status: EduAccessTaskStatus.RUNNING }) as EdubridgeAccessTaskEntity);
    });
  }

  save(task: EdubridgeAccessTaskEntity): Promise<EdubridgeAccessTaskEntity> {
    return this.repo.save(task);
  }

  findById(coopname: string, id: string): Promise<EdubridgeAccessTaskEntity | null> {
    return this.repo.findOne({ coopname, id });
  }

  findQueue(coopname: string, statuses?: EduAccessTaskStatus[], limit = 200): Promise<EdubridgeAccessTaskEntity[]> {
    return this.repo.find({ coopname, ...(statuses?.length ? { status: oneOf(statuses) } : {}) }, { order: { updated_at: 'DESC' }, limit: limit });
  }

  /** Сколько задач кооператива в этих состояниях — для счётчика на пункте меню. */
  countByStatuses(coopname: string, statuses: EduAccessTaskStatus[]): Promise<number> {
    return this.repo.count({ coopname, status: oneOf(statuses) });
  }

  findByEnrollment(coopname: string, enrollmentId: string): Promise<EdubridgeAccessTaskEntity[]> {
    return this.repo.find({ coopname, enrollment_id: enrollmentId }, { order: { created_at: 'DESC' } });
  }
}
