import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EduAccessState, EduEnrollmentStatus } from '../../domain/enums';
import { EdubridgeAdminEntity, EdubridgeEnrollmentEntity, EdubridgeLearnerEntity } from '../entities';

export interface MemberRow {
  username: string;
  learners_count: number;
  active_enrollments: number;
  attention_count: number;
}

@Injectable()
export class EdubridgeAdminRepository {
  constructor(
    @InjectRepository(EdubridgeAdminEntity) private readonly admins: Repository<EdubridgeAdminEntity>,
    @InjectRepository(EdubridgeLearnerEntity) private readonly learners: Repository<EdubridgeLearnerEntity>,
    @InjectRepository(EdubridgeEnrollmentEntity) private readonly enrollments: Repository<EdubridgeEnrollmentEntity>
  ) {}

  listAdmins(coopname: string): Promise<EdubridgeAdminEntity[]> {
    return this.admins.find({ where: { coopname }, order: { created_at: 'ASC' } });
  }

  async appoint(coopname: string, username: string, appointedBy: string): Promise<EdubridgeAdminEntity> {
    const existing = await this.admins.findOne({ where: { coopname, username } });
    if (existing) return existing;
    return this.admins.save(this.admins.create({ coopname, username, appointed_by: appointedBy }));
  }

  async dismiss(coopname: string, username: string): Promise<boolean> {
    const r = await this.admins.delete({ coopname, username });
    return Boolean(r.affected);
  }

  /** Реестр пайщиков приложения: агрегаты по обучающимся и подпискам. */
  async memberRows(coopname: string, search?: string): Promise<MemberRow[]> {
    const qb = this.learners
      .createQueryBuilder('l')
      .select('l.member_username', 'username')
      .addSelect('COUNT(DISTINCT l.id)', 'learners_count')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(*)')
            .from(EdubridgeEnrollmentEntity, 'e')
            .where('e.coopname = l.coopname AND e.member_username = l.member_username AND e.status = :active', { active: EduEnrollmentStatus.ACTIVE }),
        'active_enrollments'
      )
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(*)')
            .from(EdubridgeEnrollmentEntity, 'e2')
            .where('e2.coopname = l.coopname AND e2.member_username = l.member_username AND e2.access_state = :att', { att: EduAccessState.NEEDS_ATTENTION }),
        'attention_count'
      )
      .where('l.coopname = :coopname', { coopname })
      .groupBy('l.member_username')
      .orderBy('l.member_username', 'ASC');
    if (search) qb.andWhere('l.member_username ILIKE :s', { s: `%${search}%` });
    const rows = await qb.getRawMany();
    return rows.map((r) => ({
      username: r.username,
      learners_count: Number(r.learners_count),
      active_enrollments: Number(r.active_enrollments),
      attention_count: Number(r.attention_count),
    }));
  }
}
