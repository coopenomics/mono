import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TokenEntity } from '../entities/token.entity';
import type { TokenRepository } from '~/domain/token/repositories/token.repository';
import type { TokenDomainInterface } from '~/domain/token/interfaces/token-domain.interface';
import type { CreateTokenInputDomainInterface } from '~/domain/token/interfaces/create-token-input-domain.interface';
import type { TokenType } from '~/types/token.types';

/**
 * Реализация репозитория токенов на базе TypeORM
 * Адаптер между доменным слоем и инфраструктурой базы данных
 */
@Injectable()
export class TokenTypeormRepository implements TokenRepository {
  constructor(
    @InjectRepository(TokenEntity)
    private readonly repository: Repository<TokenEntity>
  ) {}

  /**
   * Создает новый токен
   */
  async create(tokenData: CreateTokenInputDomainInterface): Promise<TokenDomainInterface> {
    const entity = new TokenEntity();
    entity.token = tokenData.token;
    entity.userId = tokenData.userId;
    entity.type = tokenData.type;
    entity.expires = tokenData.expires;
    entity.blacklisted = tokenData.blacklisted || false;

    const saved = await this.repository.save(entity);
    return saved.toDomainEntity();
  }

  /**
   * Находит токен по его значению и типу
   */
  async findByTokenAndTypes(token: string, types: TokenType[]): Promise<TokenDomainInterface | null> {
    const entity = await this.repository.findOne({
      where: {
        token,
        type: In(types),
        blacklisted: false,
      },
    });

    return entity ? entity.toDomainEntity() : null;
  }

  /**
   * Находит токены по ID пользователя и типу
   */
  async findByUserIdAndType(userId: string, type: TokenType): Promise<TokenDomainInterface[]> {
    const entities = await this.repository.find({
      where: {
        userId,
        type,
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return entities.map((entity) => entity.toDomainEntity());
  }

  /**
   * Находит токен по ID
   */
  async findById(id: string): Promise<TokenDomainInterface | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? entity.toDomainEntity() : null;
  }

  /**
   * Удаляет токен по ID
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  /**
   * Удаляет токены по критериям
   */
  async deleteMany(criteria: Partial<TokenDomainInterface>): Promise<number> {
    const result = await this.repository.delete(criteria);
    return result.affected || 0;
  }

  /**
   * Обновляет токен по ID
   */
  async updateById(id: string, updates: Partial<TokenDomainInterface>): Promise<TokenDomainInterface | null> {
    const updateData: Partial<TokenEntity> = {};

    if (updates.token !== undefined) updateData.token = updates.token;
    if (updates.userId !== undefined) updateData.userId = updates.userId;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.expires !== undefined) updateData.expires = updates.expires;
    if (updates.blacklisted !== undefined) updateData.blacklisted = updates.blacklisted;
    if (updates.updatedAt !== undefined) updateData.updatedAt = updates.updatedAt;

    const result = await this.repository.update(id, updateData);

    if (result.affected && result.affected > 0) {
      const updatedEntity = await this.repository.findOne({ where: { id } });
      return updatedEntity ? updatedEntity.toDomainEntity() : null;
    }

    return null;
  }

  /**
   * Находит и удаляет токен по его значению и типу
   */
  async findOneAndDelete(token: string, type: TokenType): Promise<TokenDomainInterface | null> {
    const entity = await this.repository.findOne({
      where: { token, type },
    });

    if (entity) {
      await this.repository.remove(entity);
      return entity.toDomainEntity();
    }

    return null;
  }
}
