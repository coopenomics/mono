import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EduAccessTaskStatus } from '../../domain/enums';
import { EdubridgeAccessTaskEntity } from '../entities';

@Injectable()
export class EdubridgeAccessTaskRepository {
  constructor(
    @InjectRepository(EdubridgeAccessTaskEntity) private readonly repo: Repository<EdubridgeAccessTaskEntity>,
    private readonly dataSource: DataSource
  ) {}

  /** Создать задачу; дубль по `(kind, enrollment_id, trigger_trx)` молча игнорируется — идемпотентность. */
  async enqueue(data: Partial<EdubridgeAccessTaskEntity>): Promise<EdubridgeAccessTaskEntity | null> {
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .into(EdubridgeAccessTaskEntity)
      .values({ ...data, status: EduAccessTaskStatus.PENDING, attempts: 0, next_attempt_at: data.next_attempt_at ?? new Date() })
      .orIgnore()
      .returning('*')
      .execute();
    const raw = result.raw?.[0];
    return raw ? this.repo.create(raw as EdubridgeAccessTaskEntity) : null;
  }

  /**
   * Забрать пачку задач к исполнению. `FOR UPDATE SKIP LOCKED` — два экземпляра
   * контроллера не возьмут одну задачу; пометка RUNNING — в той же транзакции.
   */
  async claimDue(coopname: string, limit: number): Promise<EdubridgeAccessTaskEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager
        .getRepository(EdubridgeAccessTaskEntity)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where('t.coopname = :coopname AND t.status = :status AND t.next_attempt_at <= now()', { coopname, status: EduAccessTaskStatus.PENDING })
        .orderBy('t.next_attempt_at', 'ASC')
        .take(limit)
        .getMany();
      if (!rows.length) return [];
      await manager.getRepository(EdubridgeAccessTaskEntity).update({ id: In(rows.map((r) => r.id)) }, { status: EduAccessTaskStatus.RUNNING });
      return rows.map((r) => ({ ...r, status: EduAccessTaskStatus.RUNNING }) as EdubridgeAccessTaskEntity);
    });
  }

  save(task: EdubridgeAccessTaskEntity): Promise<EdubridgeAccessTaskEntity> {
    return this.repo.save(task);
  }

  findById(coopname: string, id: string): Promise<EdubridgeAccessTaskEntity | null> {
    return this.repo.findOne({ where: { coopname, id } });
  }

  findQueue(coopname: string, statuses?: EduAccessTaskStatus[], limit = 200): Promise<EdubridgeAccessTaskEntity[]> {
    return this.repo.find({
      where: { coopname, ...(statuses?.length ? { status: In(statuses) } : {}) },
      order: { updated_at: 'DESC' },
      take: limit,
    });
  }

  findByEnrollment(coopname: string, enrollmentId: string): Promise<EdubridgeAccessTaskEntity[]> {
    return this.repo.find({ where: { coopname, enrollment_id: enrollmentId }, order: { created_at: 'DESC' } });
  }
}
