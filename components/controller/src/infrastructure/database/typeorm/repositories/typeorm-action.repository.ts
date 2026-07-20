import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, Equal } from 'typeorm';
import type { ActionRepositoryPort } from '~/domain/parser/ports/action-repository.port';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import type {
  ActionFilterDomainInterface,
  PaginatedResultDomainInterface,
} from '~/domain/parser/interfaces/parser-config-domain.interface';
import { ActionEntity } from '../entities/action.entity';

/**
 * TypeORM реализация репозитория действий блокчейна
 */
@Injectable()
export class TypeOrmActionRepository implements ActionRepositoryPort {
  constructor(
    @InjectRepository(ActionEntity)
    private readonly actionRepository: Repository<ActionEntity>
  ) {}

  /**
   * Сохранение действия.
   *
   * Идемпотентно по global_sequence: Redis Stream доставляет at-least-once,
   * и после crash'а между записью в PG и XACK то же действие приходит
   * повторно. Дубликат — не ошибка, а признак уже выполненной работы:
   * возвращаем существующую запись, чтобы consumer мог ACK'нуть сообщение
   * и не зациклиться на retry.
   */
  async save(actionData: Omit<ActionDomainInterface, 'id' | 'created_at'>): Promise<ActionDomainInterface> {
    const entity = this.actionRepository.create(actionData);
    try {
      return await this.actionRepository.save(entity);
    } catch (e: any) {
      const pgCode = e?.code ?? e?.driverError?.code;
      if (pgCode === '23505') {
        const existing = await this.actionRepository.findOne({
          where: { global_sequence: actionData.global_sequence },
        });
        if (existing) return existing;
      }
      throw e;
    }
  }

  /**
   * Получение действий с фильтрацией и пагинацией
   */
  async findMany(
    filter: ActionFilterDomainInterface,
    page: number,
    limit: number
  ): Promise<PaginatedResultDomainInterface<ActionDomainInterface>> {
    const whereClause: any = {};

    if (filter.account) {
      whereClause.account = filter.account;
    }
    if (filter.name) {
      whereClause.name = filter.name;
    }
    if (filter.block_num) {
      whereClause.block_num = filter.block_num;
    }
    if (filter.global_sequence) {
      whereClause.global_sequence = filter.global_sequence;
    }
    if (filter.repeat !== undefined) {
      whereClause.repeat = filter.repeat;
    }

    const [results, total] = await this.actionRepository.findAndCount({
      where: whereClause,
      order: { block_num: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      results,
      page,
      limit,
      total,
    };
  }

  /**
   * Получение действия по ID
   */
  async findById(id: string): Promise<ActionDomainInterface | null> {
    return await this.actionRepository.findOne({ where: { id } });
  }

  /**
   * Удаление действий после указанного блока
   */
  async deleteAfterBlock(blockNum: number): Promise<void> {
    await this.actionRepository.delete({
      block_num: MoreThan(blockNum),
    });
  }

  /**
   * Получение общего количества действий
   */
  async count(): Promise<number> {
    return await this.actionRepository.count();
  }

  /**
   * Получение последнего действия по номеру блока
   */
  async findLastByBlock(): Promise<ActionDomainInterface | null> {
    return await this.actionRepository.findOne({
      order: { block_num: 'DESC' },
    });
  }

  /**
   * Поиск действий с флагом repeat = true
   */
  async findRepeatableActions(): Promise<ActionDomainInterface[]> {
    return await this.actionRepository.find({
      where: {
        repeat: Equal(true),
      },
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Сброс флага repeat для указанного действия
   */
  async resetRepeatFlag(id: string): Promise<void> {
    await this.actionRepository.update(id, { repeat: false });
  }
}
