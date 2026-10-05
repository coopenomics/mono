import { Inject, Injectable } from '@nestjs/common';
import { TableStore } from '@coopenomics/extension-kit';
import { EDUBRIDGE_ADMIN_STORE, EDUBRIDGE_ENROLLMENT_STORE, EDUBRIDGE_LEARNER_STORE } from '../database/edubridge-stores';
import { EduAccessState, EduEnrollmentStatus } from '../../domain/enums';
import { EdubridgeAdminRecord, EdubridgeEnrollmentRecord, EdubridgeLearnerRecord } from '../entities';

export interface MemberRow {
  username: string;
  learners_count: number;
  active_enrollments: number;
  attention_count: number;
}

@Injectable()
export class EdubridgeAdminKyselyRepository {
  constructor(
    @Inject(EDUBRIDGE_ADMIN_STORE)
    private readonly admins: TableStore<EdubridgeAdminRecord>,
    @Inject(EDUBRIDGE_LEARNER_STORE)
    private readonly learners: TableStore<EdubridgeLearnerRecord>,
    @Inject(EDUBRIDGE_ENROLLMENT_STORE)
    private readonly enrollments: TableStore<EdubridgeEnrollmentRecord>
  ) {}

  listAdmins(coopname: string): Promise<EdubridgeAdminRecord[]> {
    return this.admins.find({ coopname }, { order: { created_at: 'ASC' } });
  }

  async appoint(coopname: string, username: string, appointedBy: string): Promise<EdubridgeAdminRecord> {
    const existing = await this.admins.findOne({ coopname, username });
    if (existing) return existing;
    return this.admins.save(this.admins.create({ coopname, username, appointed_by: appointedBy }));
  }

  async dismiss(coopname: string, username: string): Promise<boolean> {
    const r = await this.admins.delete({ coopname, username });
    return Boolean(r);
  }

  /**
   * Ученики приложения: агрегаты по обучающимся и подпискам.
   * Подзапросы берут кооператив параметром, а не `l.coopname`: колонка не в
   * GROUP BY, и Postgres отвечал «Subquery uses ungrouped column l.coopname».
   */
  async memberRows(coopname: string, search?: string): Promise<MemberRow[]> {
    const enrollments = this.enrollments.table;
    const qb = this.learners
      .sqlBuilder('l')
      .select('l.member_username', 'username')
      .addSelect('COUNT(DISTINCT l.id)', 'learners_count')
      .addSelect(
        `(SELECT COUNT(*) FROM ${enrollments} e WHERE e.coopname = :coopname AND e.member_username = l.member_username AND e.status = :active)`,
        'active_enrollments'
      )
      .addSelect(
        `(SELECT COUNT(*) FROM ${enrollments} e2 WHERE e2.coopname = :coopname AND e2.member_username = l.member_username AND e2.access_state = :att)`,
        'attention_count'
      )
      .where('l.coopname = :coopname', { coopname, active: EduEnrollmentStatus.ACTIVE, att: EduAccessState.NEEDS_ATTENTION })
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
