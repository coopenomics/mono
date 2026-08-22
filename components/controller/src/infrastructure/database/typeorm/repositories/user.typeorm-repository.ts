import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import type { UserRepository } from '~/domain/user/repositories/user.repository';
import type { UserDomainEntity } from '~/domain/user/entities/user-domain.entity';
import type {
  CreateUserInputDomainInterface,
  UpdateUserInputDomainInterface,
  UserFilterInputDomainInterface,
} from '~/domain/user/interfaces';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { userStatus } from '~/types/user.types';
import { normalizeUserEmail } from '~/utils/normalize-user-email';

/**
 * Реализация репозитория пользователей на базе TypeORM
 * Адаптер между доменным слоем и инфраструктурой базы данных
 */
@Injectable()
export class UserTypeormRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>
  ) {}

  /**
   * Создает нового пользователя
   */
  async create(userData: CreateUserInputDomainInterface): Promise<UserDomainEntity> {
    const entity = new UserEntity();
    entity.username = userData.username;
    entity.status = userData.status || userStatus['1_Created'];
    entity.message = userData.message || '';
    entity.is_registered = userData.is_registered || false;
    entity.has_account = userData.has_account || false;
    entity.type = userData.type;
    entity.public_key = userData.public_key || '';
    entity.referer = userData.referer || '';
    if (userData.email !== undefined && userData.email !== null) {
      entity.email = userData.email === '' ? '' : normalizeUserEmail(userData.email);
    } else {
      entity.email = userData.email as string;
    }
    entity.role = userData.role || 'user';
    entity.is_email_verified = userData.is_email_verified || false;
    entity.subscriber_id = userData.subscriber_id || '';
    entity.subscriber_hash = userData.subscriber_hash || '';

    const saved = await this.repository.save(entity);
    return saved.toDomainEntity();
  }

  /**
   * Находит пользователя по ID
   */
  async findById(id: string): Promise<UserDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { id },
    });

    return entity ? entity.toDomainEntity() : null;
  }

  /**
   * Находит пользователя по имени пользователя
   */
  async findByUsername(username: string): Promise<UserDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { username },
    });

    return entity ? entity.toDomainEntity() : null;
  }

  /**
   * Находит пользователя по email
   */
  async findByEmail(email: string): Promise<UserDomainEntity | null> {
    const normalized = normalizeUserEmail(email);
    const entity = await this.repository
      .createQueryBuilder('user')
      .where('LOWER(TRIM(user.email)) = :normalized', { normalized })
      .getOne();

    return entity ? entity.toDomainEntity() : null;
  }

  /**
   * Находит пользователя по subscriber_id
   */
  async findBySubscriberId(subscriberId: string): Promise<UserDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { subscriber_id: subscriberId },
    });

    return entity ? entity.toDomainEntity() : null;
  }

  /**
   * Находит пользователя по legacy MongoDB ObjectId
   */
  async findByLegacyMongoId(legacyMongoId: string): Promise<UserDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { legacy_mongo_id: legacyMongoId },
    });

    return entity ? entity.toDomainEntity() : null;
  }

  /**
   * Проверяет, занят ли email
   */
  async isEmailTaken(email: string, excludeUsername?: string): Promise<boolean> {
    const normalized = normalizeUserEmail(email);
    const query = this.repository
      .createQueryBuilder('user')
      .where('LOWER(TRIM(user.email)) = :normalized', { normalized });

    if (excludeUsername) {
      query.andWhere('user.username != :excludeUsername', { excludeUsername });
    }

    const count = await query.getCount();
    return count > 0;
  }

  /**
   * Обновляет пользователя по имени пользователя
   */
  async updateByUsername(username: string, updates: UpdateUserInputDomainInterface): Promise<UserDomainEntity | null> {
    const updateData: Partial<UserEntity> = {};

    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.message !== undefined) updateData.message = updates.message;
    if (updates.is_registered !== undefined) updateData.is_registered = updates.is_registered;
    if (updates.has_account !== undefined) updateData.has_account = updates.has_account;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.public_key !== undefined) updateData.public_key = updates.public_key;
    if (updates.referer !== undefined) updateData.referer = updates.referer;
    if (updates.email !== undefined)
      updateData.email =
        updates.email === null || updates.email === '' ? updates.email : normalizeUserEmail(updates.email);
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.is_email_verified !== undefined) updateData.is_email_verified = updates.is_email_verified;
    if (updates.subscriber_id !== undefined) updateData.subscriber_id = updates.subscriber_id;
    if (updates.subscriber_hash !== undefined) updateData.subscriber_hash = updates.subscriber_hash;

    const result = await this.repository.update({ username }, updateData);

    if (result.affected && result.affected > 0) {
      // Обновление может ПЕРЕИМЕНОВАТЬ пользователя (повторная регистрация со
      // старым незавершённым аккаунтом генерирует новый username) — перечитка по
      // старому имени находила пустоту, и успешное обновление превращалось в
      // «Пользователь не найден».
      const currentUsername = updateData.username ?? username;
      const updatedEntity = await this.repository.findOne({ where: { username: currentUsername } });
      return updatedEntity ? updatedEntity.toDomainEntity() : null;
    }

    return null;
  }

  /**
   * Обновляет пользователя по ID
   */
  async updateById(id: string, updates: UpdateUserInputDomainInterface): Promise<UserDomainEntity | null> {
    const updateData: Partial<UserEntity> = {};

    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.message !== undefined) updateData.message = updates.message;
    if (updates.is_registered !== undefined) updateData.is_registered = updates.is_registered;
    if (updates.has_account !== undefined) updateData.has_account = updates.has_account;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.public_key !== undefined) updateData.public_key = updates.public_key;
    if (updates.referer !== undefined) updateData.referer = updates.referer;
    if (updates.email !== undefined)
      updateData.email =
        updates.email === null || updates.email === '' ? updates.email : normalizeUserEmail(updates.email);
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.is_email_verified !== undefined) updateData.is_email_verified = updates.is_email_verified;
    if (updates.subscriber_id !== undefined) updateData.subscriber_id = updates.subscriber_id;
    if (updates.subscriber_hash !== undefined) updateData.subscriber_hash = updates.subscriber_hash;

    const result = await this.repository.update(id, updateData);

    if (result.affected && result.affected > 0) {
      const updatedEntity = await this.repository.findOne({ where: { id } });
      return updatedEntity ? updatedEntity.toDomainEntity() : null;
    }

    return null;
  }

  /**
   * Удаляет пользователя по имени пользователя
   */
  async deleteByUsername(username: string): Promise<boolean> {
    const result = await this.repository.delete({ username });
    return result.affected ? result.affected > 0 : false;
  }

  /**
   * Удаляет пользователя по ID
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  /**
   * Находит пользователей с пагинацией
   */
  async findAllPaginated(
    filter?: UserFilterInputDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<UserDomainEntity>> {
    const queryBuilder = this.repository.createQueryBuilder('user');

    // Применяем фильтры
    if (filter) {
      if (filter.username) {
        queryBuilder.andWhere('user.username = :username', { username: filter.username });
      }
      if (filter.email) {
        queryBuilder.andWhere('LOWER(TRIM(user.email)) = :filterEmail', {
          filterEmail: normalizeUserEmail(filter.email),
        });
      }
      if (filter.status) {
        queryBuilder.andWhere('user.status = :status', { status: filter.status });
      }
      if (filter.type) {
        queryBuilder.andWhere('user.type = :type', { type: filter.type });
      }
      if (filter.role) {
        queryBuilder.andWhere('user.role = :role', { role: filter.role });
      }
      if (filter.is_email_verified !== undefined) {
        queryBuilder.andWhere('user.is_email_verified = :is_email_verified', {
          is_email_verified: filter.is_email_verified,
        });
      }
      if (filter.has_account !== undefined) {
        queryBuilder.andWhere('user.has_account = :has_account', { has_account: filter.has_account });
      }
      if (filter.is_registered !== undefined) {
        queryBuilder.andWhere('user.is_registered = :is_registered', { is_registered: filter.is_registered });
      }
      if (filter.subscriber_id) {
        queryBuilder.andWhere('user.subscriber_id = :subscriber_id', { subscriber_id: filter.subscriber_id });
      }
      if (filter.created_from) {
        queryBuilder.andWhere('user.created_at >= :created_from', { created_from: filter.created_from });
      }
      if (filter.created_to) {
        queryBuilder.andWhere('user.created_at <= :created_to', { created_to: filter.created_to });
      }
    }

    // Применяем пагинацию
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    // Применяем сортировку
    if (options?.sortBy) {
      const [field, direction] = options.sortBy.split(':');
      const orderDirection = direction === 'desc' ? 'DESC' : 'ASC';
      queryBuilder.orderBy(`user.${field}`, orderDirection);
    } else {
      queryBuilder.orderBy('user.created_at', 'DESC');
    }

    const [entities, total] = await queryBuilder.getManyAndCount();

    return {
      items: entities.map((entity) => entity.toDomainEntity()),
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalCount: total,
    };
  }

  /**
   * Находит пользователей без subscriber_id для синхронизации уведомлений
   */
  async findUsersWithoutSubscriberId(limit = 100): Promise<UserDomainEntity[]> {
    const entities = await this.repository.find({
      where: [{ subscriber_id: IsNull() }, { subscriber_id: '' }],
      take: limit,
      order: {
        createdAt: 'ASC',
      },
    });

    return entities.map((entity) => entity.toDomainEntity());
  }

  /**
   * Находит пользователей по ролям
   */
  async findByRoles(roles: string[]): Promise<UserDomainEntity[]> {
    const entities = await this.repository.find({
      where: {
        role: In(roles),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return entities.map((entity) => entity.toDomainEntity());
  }
}
