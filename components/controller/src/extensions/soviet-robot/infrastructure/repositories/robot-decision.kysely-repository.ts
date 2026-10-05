import { Inject, Injectable } from '@nestjs/common';
import { sql, type Kysely, type Selectable } from 'kysely';
import { KYSELY, sortColumn, sortDirection } from '@coopenomics/extension-kit';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import type { RobotDecisionDomainEntity, RobotVoteRecord } from '../../domain/entities/robot-decision.entity';
import type { RobotDecisionCreate, RobotDecisionRepository } from '../../domain/repositories/robot-decision.repository';
import type { RobotDecisionStage } from '../../domain/enums/robot-decision-stage.enum';
import type { DB, SovietRobotDecisions } from '../database/soviet-robot.database.types';

const SORT_COLUMNS = ['decision_id', 'created_at', 'updated_at', 'stage'] as const;

function toDomain(row: Selectable<SovietRobotDecisions>): RobotDecisionDomainEntity {
  return {
    ...row,
    stage: row.stage as RobotDecisionStage,
    votes: row.votes as unknown as RobotVoteRecord[],
    waiting_for: row.waiting_for as unknown as string[],
    tx_hashes: row.tx_hashes as unknown as string[],
  };
}

/** Решения совета в работе у робота (таблица `soviet_robot_decisions`). */
@Injectable()
export class RobotDecisionKyselyRepository implements RobotDecisionRepository {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async findByDecision(coopname: string, decision_id: number): Promise<RobotDecisionDomainEntity | null> {
    const row = await this.db
      .selectFrom('soviet_robot_decisions')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('decision_id', '=', decision_id)
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  /**
   * Идемпотентно при гонке двух доставок события: уникальный индекс пропускает
   * одну вставку, проигравший перечитывает запись победителя.
   */
  async createIfAbsent(data: RobotDecisionCreate): Promise<RobotDecisionDomainEntity> {
    const inserted = await this.db
      .insertInto('soviet_robot_decisions')
      .values({ ...data, votes: '[]', waiting_for: '[]', tx_hashes: '[]', attempts: 0 })
      .onConflict((conflict) => conflict.doNothing())
      .returningAll()
      .executeTakeFirst();
    if (inserted) return toDomain(inserted);
    const existing = await this.findByDecision(data.coopname, data.decision_id);
    if (!existing) throw new Error(`Robot decision ${data.coopname}/${data.decision_id} was not created`);
    return existing;
  }

  async save(entity: RobotDecisionDomainEntity): Promise<RobotDecisionDomainEntity> {
    const row = await this.db
      .updateTable('soviet_robot_decisions')
      .set({
        decision_type: entity.decision_type,
        decision_hash: entity.decision_hash,
        username: entity.username,
        stage: entity.stage,
        votes: JSON.stringify(entity.votes),
        waiting_for: JSON.stringify(entity.waiting_for),
        protocol_hash: entity.protocol_hash,
        tx_hashes: JSON.stringify(entity.tx_hashes),
        last_error: entity.last_error,
        attempts: entity.attempts,
        next_attempt_at: entity.next_attempt_at,
        updated_at: sql`now()`,
      })
      .where('id', '=', entity.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  /** Решения к обработке: нужная стадия, время повтора пусто или наступило; по номеру решения. */
  async findDue(coopname: string, stages: RobotDecisionStage[], now: Date, limit: number): Promise<RobotDecisionDomainEntity[]> {
    if (stages.length === 0) return [];
    const rows = await this.db
      .selectFrom('soviet_robot_decisions')
      .selectAll()
      .where('coopname', '=', coopname)
      .where('stage', 'in', stages)
      .where((eb) => eb.or([eb('next_attempt_at', 'is', null), eb('next_attempt_at', '<=', now)]))
      .orderBy('decision_id', 'asc')
      .limit(limit)
      .execute();
    return rows.map(toDomain);
  }

  async findPaginated(coopname: string, options?: PaginationInputDTO): Promise<PaginationResult<RobotDecisionDomainEntity>> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(200, Math.max(1, options?.limit ?? 20));
    const query = this.db.selectFrom('soviet_robot_decisions').where('coopname', '=', coopname);

    const rows = await query
      .selectAll()
      .orderBy(sortColumn(SORT_COLUMNS, options?.sortBy, 'decision_id'), sortDirection(options?.sortOrder))
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    const totalCount = Number(total.count);

    return { items: rows.map(toDomain), totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)), currentPage: page };
  }
}
