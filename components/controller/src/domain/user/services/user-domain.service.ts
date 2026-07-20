import { Injectable, Inject, Logger } from '@nestjs/common';
import { HttpApiError } from '~/utils/httpApiError';
import httpStatus from 'http-status';
import { UserRepository, USER_REPOSITORY } from '../repositories/user.repository';
import type { UserDomainEntity } from '../entities/user-domain.entity';
import type {
  CreateUserInputDomainInterface,
  UpdateUserInputDomainInterface,
  UserFilterInputDomainInterface,
} from '../interfaces';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';

/**
 * Токен для инъекции зависимости сервиса пользователей
 */
export const USER_DOMAIN_SERVICE = Symbol('UserDomainService');
import { userStatus } from '~/types/user.types';
import { normalizeUserEmail } from '~/utils/normalize-user-email';

/**
 * Доменный сервис для работы с пользователями
 * Инкапсулирует бизнес-логику работы с пользователями
 */
@Injectable()
export class UserDomainService {
  private readonly logger = new Logger(UserDomainService.name);

  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  /**
   * Создает нового пользователя
   * @param userData - данные пользователя
   * @returns созданный пользователь
   */
  async createUser(userData: CreateUserInputDomainInterface): Promise<UserDomainEntity> {
    this.logger.log(`Создание пользователя ${userData.username}`);

    const normalizedEmail = normalizeUserEmail(userData.email);

    // Проверяем, существует ли пользователь с таким email
    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Пользователь с указанным EMAIL уже зарегистрирован');
    }

    // Проверяем, существует ли пользователь с таким username
    const existingUsername = await this.userRepository.findByUsername(userData.username);
    if (existingUsername) {
      throw new HttpApiError(httpStatus.BAD_REQUEST, 'Пользователь с указанным именем уже зарегистрирован');
    }

    // Создаем пользователя
    const user = await this.userRepository.create({
      ...userData,
      email: normalizedEmail,
      status: userData.status || userStatus['1_Created'],
      is_registered: userData.is_registered || false,
      has_account: userData.has_account || false,
      public_key: userData.public_key || '',
      referer: userData.referer || '',
      role: userData.role || 'user',
      is_email_verified: userData.is_email_verified || false,
      subscriber_id: userData.subscriber_id || '',
      subscriber_hash: userData.subscriber_hash || '',
    });

    this.logger.log(`Пользователь ${user.username} успешно создан`);
    return user;
  }

  /**
   * Получает пользователя по имени пользователя
   * @param username - имя пользователя
   * @returns пользователь
   */
  async getUserByUsername(username: string): Promise<UserDomainEntity> {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
    }
    return user;
  }

  /**
   * Ищет пользователя по имени пользователя (опциональный поиск)
   * @param username - имя пользователя
   * @returns пользователь или null, если не найден
   */
  async findUserByUsername(username: string): Promise<UserDomainEntity | null> {
    return this.userRepository.findByUsername(username);
  }

  /**
   * Получает пользователя по ID
   * @param id - ID пользователя
   * @returns пользователь
   */
  async getUserById(id: string): Promise<UserDomainEntity> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
    }
    return user;
  }

  /**
   * Ищет пользователя по ID (опциональный поиск)
   * @param id - ID пользователя
   * @returns пользователь или null, если не найден
   */
  async findUserById(id: string): Promise<UserDomainEntity | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Получает пользователя по email
   * @param email - email пользователя
   * @returns пользователь
   */
  async getUserByEmail(email: string): Promise<UserDomainEntity> {
    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
    }
    return user;
  }

  /**
   * Ищет пользователя по email (опциональный поиск)
   * @param email - email пользователя
   * @returns пользователь или null, если не найден
   */
  async findUserByEmail(email: string): Promise<UserDomainEntity | null> {
    return this.userRepository.findByEmail(email);
  }

  /**
   * Получает пользователя по subscriber_id
   * @param subscriberId - ID подписчика
   * @returns пользователь
   */
  async getUserBySubscriberId(subscriberId: string): Promise<UserDomainEntity> {
    const user = await this.userRepository.findBySubscriberId(subscriberId);
    if (!user) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
    }
    return user;
  }

  /**
   * Обновляет пользователя по имени пользователя
   * @param username - имя пользователя
   * @param updates - поля для обновления
   * @returns обновленный пользователь
   */
  async updateUserByUsername(username: string, updates: UpdateUserInputDomainInterface): Promise<UserDomainEntity> {
    this.logger.log(`Обновление пользователя ${username}`);

    // Проверяем, существует ли пользователь
    const existingUser = await this.getUserByUsername(username);

    // Проверяем email на уникальность, если он обновляется (без учёта регистра)
    if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
      const nextEmail = normalizeUserEmail(updates.email);
      const currentEmailNorm = existingUser.email ? normalizeUserEmail(existingUser.email) : '';
      if (nextEmail !== currentEmailNorm) {
        const emailTaken = await this.userRepository.isEmailTaken(nextEmail, username);
        if (emailTaken) {
          throw new HttpApiError(httpStatus.BAD_REQUEST, 'Email уже занят');
        }
      }
    }

    // Обновляем пользователя
    const updatedUser = await this.userRepository.updateByUsername(username, updates);
    if (!updatedUser) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
    }

    this.logger.log(`Пользователь ${username} успешно обновлен`);
    return updatedUser;
  }

  /**
   * Обновляет пользователя по ID
   * @param id - ID пользователя
   * @param updates - поля для обновления
   * @returns обновленный пользователь
   */
  async updateUserById(id: string, updates: UpdateUserInputDomainInterface): Promise<UserDomainEntity> {
    this.logger.log(`Обновление пользователя с ID ${id}`);

    const existingUser = await this.userRepository.findById(id);
    if (!existingUser) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
    }

    if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
      const nextEmail = normalizeUserEmail(updates.email);
      const currentEmailNorm = existingUser.email ? normalizeUserEmail(existingUser.email) : '';
      if (nextEmail !== currentEmailNorm) {
        const emailTaken = await this.userRepository.isEmailTaken(nextEmail, existingUser.username);
        if (emailTaken) {
          throw new HttpApiError(httpStatus.BAD_REQUEST, 'Email уже занят');
        }
      }
    }

    // Обновляем пользователя
    const updatedUser = await this.userRepository.updateById(id, updates);
    if (!updatedUser) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
    }

    this.logger.log(`Пользователь с ID ${id} успешно обновлен`);
    return updatedUser;
  }

  /**
   * Удаляет пользователя по имени пользователя
   * @param username - имя пользователя
   * @returns true, если пользователь был удален
   */
  async deleteUserByUsername(username: string): Promise<boolean> {
    this.logger.log(`Удаление пользователя ${username}`);

    const result = await this.userRepository.deleteByUsername(username);
    if (result) {
      this.logger.log(`Пользователь ${username} успешно удален`);
    }
    return result;
  }

  /**
   * Удаляет пользователя по ID
   * @param id - ID пользователя
   * @returns true, если пользователь был удален
   */
  async deleteUserById(id: string): Promise<boolean> {
    this.logger.log(`Удаление пользователя с ID ${id}`);

    const result = await this.userRepository.deleteById(id);
    if (result) {
      this.logger.log(`Пользователь с ID ${id} успешно удален`);
    }
    return result;
  }

  /**
   * Получает пользователей с пагинацией
   * @param filter - фильтр для поиска
   * @param options - опции пагинации
   * @returns результат пагинации с пользователями
   */
  async queryUsers(
    filter?: UserFilterInputDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<UserDomainEntity>> {
    return this.userRepository.findAllPaginated(filter, options);
  }

  /**
   * Получает пользователей без subscriber_id для синхронизации уведомлений
   * @param limit - ограничение количества результатов
   * @returns массив пользователей
   */
  async findUsersWithoutSubscriberId(limit = 100): Promise<UserDomainEntity[]> {
    return this.userRepository.findUsersWithoutSubscriberId(limit);
  }

  /**
   * Получает пользователей по ролям
   * @param roles - роли для поиска
   * @returns массив пользователей
   */
  async findUsersByRoles(roles: string[]): Promise<UserDomainEntity[]> {
    return this.userRepository.findByRoles(roles);
  }

  /**
   * Получает пользователя по legacy MongoDB ObjectId
   * @param legacyMongoId - старый ObjectId из MongoDB
   * @returns пользователь
   */
  async getUserByLegacyMongoId(legacyMongoId: string): Promise<UserDomainEntity> {
    const user = await this.userRepository.findByLegacyMongoId(legacyMongoId);
    if (!user) {
      throw new HttpApiError(httpStatus.NOT_FOUND, 'Пользователь не найден');
    }
    return user;
  }

  /**
   * Ищет пользователя по legacy MongoDB ObjectId (опциональный поиск)
   * @param legacyMongoId - старый ObjectId из MongoDB
   * @returns пользователь или null, если не найден
   */
  async findUserByLegacyMongoId(legacyMongoId: string): Promise<UserDomainEntity | null> {
    return this.userRepository.findByLegacyMongoId(legacyMongoId);
  }

  /**
   * Проверяет, занят ли email
   * @param email - email для проверки
   * @param excludeUsername - имя пользователя, которого нужно исключить из проверки
   * @returns true, если email занят
   */
  async isEmailTaken(email: string, excludeUsername?: string): Promise<boolean> {
    return this.userRepository.isEmailTaken(email, excludeUsername);
  }

  /**
   * Генерирует уникальный subscriber_id с проверкой на дублирование
   * @param coopname Название кооператива
   * @param maxRetries Максимальное количество попыток (по умолчанию 5)
   * @returns Уникальный subscriber_id
   */
  async generateSubscriberId(coopname: string, maxRetries = 5): Promise<string> {
    const { randomBytes } = await import('crypto');

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Генерируем случайный subscriber_id в формате: coopname:16_hex_chars
      const randomId = randomBytes(16).toString('hex');
      const subscriberId = `${coopname}:${randomId}`;

      // Проверяем, что такой subscriber_id не существует
      const existingUser = await this.userRepository.findBySubscriberId(subscriberId);

      if (!existingUser) {
        return subscriberId;
      }

      // Если subscriber_id уже существует, пробуем еще раз
      this.logger.warn(`Дублирование subscriber_id: ${subscriberId}, попытка ${attempt + 1}/${maxRetries}`);
    }

    throw new Error(`Не удалось сгенерировать уникальный subscriber_id после ${maxRetries} попыток`);
  }
}
