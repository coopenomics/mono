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
import { isHexHash } from '~/shared/sql/hex-value.util';

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
    } catch (err: any) {
      // global_sequence — глобально-уникальный монотонный id действия в истории
      // цепи. Дубль (23505) означает повторную доставку того же действия
      // (re-scan/replay стрима) — оно уже сохранено. Идемпотентно: не бросаем,
      // иначе consumer не ACK'ает сообщение и зацикливает recoverOwnPending.
      if (err?.code === '23505' || err?.driverError?.code === '23505') {
        const existing = await this.actionRepository.findOne({
          where: { global_sequence: actionData.global_sequence },
        });
        if (existing) return existing;
      }
      throw err;
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
    const qb = this.actionRepository.createQueryBuilder('a');

    if (filter.account) {
      qb.andWhere('a.account = :account', { account: filter.account });
    }
    if (filter.name) {
      qb.andWhere('a.name = :name', { name: filter.name });
    }
    if (filter.receiver) {
      qb.andWhere('a.receiver = :receiver', { receiver: filter.receiver });
    }
    if (filter.block_num) {
      qb.andWhere('a.block_num = :block_num', { block_num: filter.block_num });
    }
    if (filter.global_sequence) {
      qb.andWhere('a.global_sequence = :global_sequence', { global_sequence: filter.global_sequence });
    }
    if (filter.repeat !== undefined) {
      qb.andWhere('a.repeat = :repeat', { repeat: filter.repeat });
    }
    // Поля полезной нагрузки лежат в jsonb и сравниваются как текст (->> / #>>):
    // число из цепи и его строковая запись совпадают одинаково. Ключ с точками —
    // путь вглубь (`document.hash`), поэтому берём #>> с массивом пути. Имена
    // параметров нумеруем: двух одинаковых плейсхолдеров TypeORM не разведёт.
    //
    // Хэш сравнивается без учёта регистра — см. isHexHash.
    Object.entries(filter.data ?? {}).forEach(([field, value], i) => {
      const path = field.split('.');
      const text = String(value);
      const wrap = (expression: string) => (isHexHash(text) ? `lower(${expression})` : expression);
      const param = isHexHash(text) ? text.toLowerCase() : text;

      if (path.length === 1) {
        qb.andWhere(`${wrap(`a.data ->> :dataField${i}`)} = :dataValue${i}`, {
          [`dataField${i}`]: field,
          [`dataValue${i}`]: param,
        });
      } else {
        qb.andWhere(`${wrap(`a.data #>> :dataPath${i}::text[]`)} = :dataValue${i}`, {
          [`dataPath${i}`]: `{${path.join(',')}}`,
          [`dataValue${i}`]: param,
        });
      }
    });

    const [results, total] = await qb
      .orderBy('a.block_num', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

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
