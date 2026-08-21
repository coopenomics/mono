import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { EduEnrollmentStatus } from '../../domain/enums';
import { EdubridgeEnrollmentEntity } from '../entities';

@Injectable()
export class EdubridgeEnrollmentRepository {
  constructor(@InjectRepository(EdubridgeEnrollmentEntity) private readonly repo: Repository<EdubridgeEnrollmentEntity>) {}

  findByMember(coopname: string, member: string): Promise<EdubridgeEnrollmentEntity[]> {
    return this.repo.find({ where: { coopname, member_username: member }, order: { created_at: 'ASC' } });
  }

  findByLearner(coopname: string, learnerId: string): Promise<EdubridgeEnrollmentEntity[]> {
    return this.repo.find({ where: { coopname, learner_id: learnerId } });
  }

  findById(coopname: string, id: string): Promise<EdubridgeEnrollmentEntity | null> {
    return this.repo.findOne({ where: { coopname, id } });
  }

  findByPair(coopname: string, learnerId: string, courseId: string): Promise<EdubridgeEnrollmentEntity | null> {
    return this.repo.findOne({ where: { coopname, learner_id: learnerId, course_id: courseId } });
  }

  findBySubHash(subHash: string): Promise<EdubridgeEnrollmentEntity | null> {
    return this.repo.findOne({ where: { sub_hash: subHash.toLowerCase() } });
  }

  /** Активные подписки с истёкшим периодом — для воркера отзыва. */
  findExpired(coopname: string, now: Date, limit = 100): Promise<EdubridgeEnrollmentEntity[]> {
    return this.repo.find({
      where: { coopname, status: EduEnrollmentStatus.ACTIVE, paid_until: LessThanOrEqual(now) },
      order: { paid_until: 'ASC' },
      take: limit,
    });
  }

  /** Активные, у которых период заканчивается до `until` и предупреждение ещё не отправлялось. */
  async findExpiringSoon(coopname: string, until: Date, limit = 200): Promise<EdubridgeEnrollmentEntity[]> {
    return this.repo
      .createQueryBuilder('e')
      .where('e.coopname = :coopname AND e.status = :status', { coopname, status: EduEnrollmentStatus.ACTIVE })
      .andWhere('e.paid_until <= :until AND e.paid_until > now()', { until })
      .andWhere('(e.expiry_notified_at IS NULL OR e.expiry_notified_at < e.updated_at)')
      .orderBy('e.paid_until', 'ASC')
      .take(limit)
      .getMany();
  }

  findActiveByMember(coopname: string, member: string): Promise<EdubridgeEnrollmentEntity[]> {
    return this.repo.find({ where: { coopname, member_username: member, status: In([EduEnrollmentStatus.ACTIVE, EduEnrollmentStatus.PENDING]) } });
  }

  create(data: Partial<EdubridgeEnrollmentEntity>): EdubridgeEnrollmentEntity {
    return this.repo.create(data);
  }

  save(entity: EdubridgeEnrollmentEntity): Promise<EdubridgeEnrollmentEntity> {
    return this.repo.save(entity);
  }
}
