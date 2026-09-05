import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { RobotDecisionTypeormEntity } from '../entities/robot-decision-typeorm.entity';
import type { RobotDecisionDomainEntity } from '../../domain/entities/robot-decision.entity';
import type { RobotDecisionCreate, RobotDecisionRepository } from '../../domain/repositories/robot-decision.repository';
import type { RobotDecisionStage } from '../../domain/enums/robot-decision-stage.enum';

@Injectable()
export class RobotDecisionTypeormRepository implements RobotDecisionRepository {
  constructor(
    @InjectRepository(RobotDecisionTypeormEntity)
    private readonly repository: Repository<RobotDecisionTypeormEntity>
  ) {}

  async findByDecision(coopname: string, decision_id: number): Promise<RobotDecisionDomainEntity | null> {
    return this.repository.findOne({ where: { coopname, decision_id } });
  }

  async createIfAbsent(data: RobotDecisionCreate): Promise<RobotDecisionDomainEntity> {
    // Уникальный индекс держит идемпотентность при гонке двух доставок события:
    // проигравший INSERT падает, и мы просто перечитываем запись победителя.
    const existing = await this.findByDecision(data.coopname, data.decision_id);
    if (existing) return existing;
    try {
      return await this.repository.save(this.repository.create({ ...data, votes: [], tx_hashes: [], attempts: 0 }));
    } catch (e) {
      const again = await this.findByDecision(data.coopname, data.decision_id);
      if (again) return again;
      throw e;
    }
  }

  async save(entity: RobotDecisionDomainEntity): Promise<RobotDecisionDomainEntity> {
    return this.repository.save(entity as RobotDecisionTypeormEntity);
  }

  async findDue(coopname: string, stages: RobotDecisionStage[], now: Date, limit: number): Promise<RobotDecisionDomainEntity[]> {
    // Условия «время повтора пусто или наступило» собираются query builder'ом:
    // операторы typeorm из другой копии пакета не проходят instanceof.
    return this.repository
      .createQueryBuilder('d')
      .where('d.coopname = :coopname', { coopname })
      .andWhere('d.stage IN (:...stages)', { stages })
      .andWhere('(d.next_attempt_at IS NULL OR d.next_attempt_at <= :now)', { now })
      .orderBy('d.decision_id', 'ASC')
      .limit(limit)
      .getMany();
  }

  async findPaginated(coopname: string, options?: PaginationInputDTO): Promise<PaginationResult<RobotDecisionDomainEntity>> {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(200, Math.max(1, options?.limit ?? 20));
    const sortBy = options?.sortBy && ['decision_id', 'created_at', 'updated_at', 'stage'].includes(options.sortBy)
      ? options.sortBy
      : 'decision_id';
    const sortOrder = options?.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const [items, totalCount] = await this.repository.findAndCount({
      where: { coopname },
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)), currentPage: page };
  }
}
