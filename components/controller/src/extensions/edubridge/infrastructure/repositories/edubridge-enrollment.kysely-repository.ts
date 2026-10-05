import { TableStore, lessOrEqual, notNull, oneOf } from '@coopenomics/extension-kit';
import { EDUBRIDGE_ENROLLMENT_STORE } from '../database/edubridge-stores';
import { Inject, Injectable } from '@nestjs/common';
import { EduEnrollmentStatus } from '../../domain/enums';
import { EdubridgeEnrollmentRecord } from '../entities';

@Injectable()
export class EdubridgeEnrollmentKyselyRepository {
  constructor(@Inject(EDUBRIDGE_ENROLLMENT_STORE) private readonly repo: TableStore<EdubridgeEnrollmentRecord>) {}

  findByMember(coopname: string, member: string): Promise<EdubridgeEnrollmentRecord[]> {
    return this.repo.find({ coopname, member_username: member }, { order: { created_at: 'ASC' } });
  }

  findByLearner(coopname: string, learnerId: string): Promise<EdubridgeEnrollmentRecord[]> {
    return this.repo.find({ coopname, learner_id: learnerId });
  }

  findById(coopname: string, id: string): Promise<EdubridgeEnrollmentRecord | null> {
    return this.repo.findOne({ coopname, id });
  }

  /** Подписки на курс — отмена по недобору идёт сразу по всем участникам. */
  findByCourse(coopname: string, courseId: string): Promise<EdubridgeEnrollmentRecord[]> {
    return this.repo.find({ coopname, course_id: courseId }, { order: { created_at: 'ASC' } });
  }

  findByPair(coopname: string, learnerId: string, courseId: string): Promise<EdubridgeEnrollmentRecord | null> {
    return this.repo.findOne({ coopname, learner_id: learnerId, course_id: courseId });
  }

  findBySubHash(subHash: string): Promise<EdubridgeEnrollmentRecord | null> {
    return this.repo.findOne({ sub_hash: subHash.toLowerCase() });
  }

  /** Активные подписки с истёкшим периодом — для воркера отзыва. */
  /** Действующие подписки с удержанным взносом — кандидаты на разблокировку по истечении гарантийного срока курса. */
  findLocked(coopname: string, limit = 200): Promise<EdubridgeEnrollmentRecord[]> {
    return this.repo
      .sqlBuilder('e')
      .where('e.coopname = :coopname', { coopname })
      .andWhere('e.status = :status', { status: EduEnrollmentStatus.ACTIVE })
      .andWhere('e.locked_amount IS NOT NULL')
      .orderBy('e.updated_at', 'ASC')
      .limit(limit)
      .getMany();
  }

  findExpired(coopname: string, now: Date, limit = 100): Promise<EdubridgeEnrollmentRecord[]> {
    return this.repo.find({ coopname, status: EduEnrollmentStatus.ACTIVE, paid_until: lessOrEqual(now) }, { order: { paid_until: 'ASC' }, limit: limit });
  }

  /** Активные, у которых период заканчивается до `until` и предупреждение ещё не отправлялось. */
  async findExpiringSoon(coopname: string, until: Date, limit = 200): Promise<EdubridgeEnrollmentRecord[]> {
    return this.repo
      .sqlBuilder('e')
      .where('e.coopname = :coopname AND e.status = :status', { coopname, status: EduEnrollmentStatus.ACTIVE })
      .andWhere('e.paid_until <= :until AND e.paid_until > now()', { until })
      .andWhere('(e.expiry_notified_at IS NULL OR e.expiry_notified_at < e.updated_at)')
      .orderBy('e.paid_until', 'ASC')
      .limit(limit)
      .getMany();
  }

  /** Подписки, закрытие которых при выходе пайщика не прошло, — для повтора. */
  findClosePending(coopname: string, limit = 100): Promise<EdubridgeEnrollmentRecord[]> {
    return this.repo.find({ coopname, close_pending_since: notNull() }, { order: { close_pending_since: 'ASC' }, limit });
  }

  countClosePending(coopname: string): Promise<number> {
    return this.repo.count({ coopname, close_pending_since: notNull() });
  }

  findActiveByMember(coopname: string, member: string): Promise<EdubridgeEnrollmentRecord[]> {
    return this.repo.find({ coopname, member_username: member, status: oneOf([EduEnrollmentStatus.ACTIVE, EduEnrollmentStatus.PENDING]) });
  }

  create(data: Partial<EdubridgeEnrollmentRecord>): EdubridgeEnrollmentRecord {
    return this.repo.create(data);
  }

  save(entity: EdubridgeEnrollmentRecord): Promise<EdubridgeEnrollmentRecord> {
    return this.repo.save(entity);
  }
}
