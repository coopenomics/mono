import { TableStore, isNull, notNull, oneOf } from '@coopenomics/extension-kit';
import { MARKETPLACE_AVAILABLE_CATEGORY_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
import { AvailableCategoryDomainRepository } from '../../domain/repositories/available-category-domain.repository';
import { AvailableCategoryDomainEntity } from '../../domain/entities/available-category-domain.entity';
import { AvailableCategoryEntity } from '../entities/available-category.entity';
import { AvailableCategoryMapper } from '../mappers/available-category.mapper';

@Injectable()
export class AvailableCategoryRepositoryAdapter implements AvailableCategoryDomainRepository {
  constructor(
    @Inject(MARKETPLACE_AVAILABLE_CATEGORY_STORE)
private readonly availableCategoryRepository: TableStore<AvailableCategoryEntity>
  ) {}

  async findByCoopname(coopname: string): Promise<AvailableCategoryDomainEntity[]> {
    const entities = await this.availableCategoryRepository.find({ coopname }, { order: { createdAt: 'DESC' } });
    return AvailableCategoryMapper.toDomainArray(entities);
  }

  async findActiveByCoopname(coopname: string): Promise<AvailableCategoryDomainEntity[]> {
    const entities = await this.availableCategoryRepository.find({ coopname, isActive: true }, { order: { createdAt: 'DESC' } });
    return AvailableCategoryMapper.toDomainArray(entities);
  }

  async findByCoopnameAndCategoryId(
    coopname: string,
    categoryId: number,
    typeId?: number
  ): Promise<AvailableCategoryDomainEntity | null> {
    const whereCondition: any = { coopname, categoryId };
    if (typeId !== undefined) {
      whereCondition.typeId = typeId;
    } else {
      whereCondition.typeId = isNull();
    }

    const entity = await this.availableCategoryRepository.findOne(whereCondition);
    return entity ? AvailableCategoryMapper.toDomain(entity) : null;
  }

  async save(availableCategory: AvailableCategoryDomainEntity): Promise<AvailableCategoryDomainEntity> {
    const entity = AvailableCategoryMapper.toEntity(availableCategory);
    const saved = await this.availableCategoryRepository.save(entity);
    return AvailableCategoryMapper.toDomain(saved);
  }

  async saveMany(availableCategories: AvailableCategoryDomainEntity[]): Promise<AvailableCategoryDomainEntity[]> {
    const entities = AvailableCategoryMapper.toEntityArray(availableCategories);
    const saved = await this.availableCategoryRepository.saveMany(entities);
    return AvailableCategoryMapper.toDomainArray(saved);
  }

  async delete(id: number): Promise<void> {
    await this.availableCategoryRepository.delete({ id });
  }

  async addCategory(coopname: string, categoryId: number, addedBy: string): Promise<AvailableCategoryDomainEntity> {
    // Проверяем, не существует ли уже такая запись для всей категории
    const existing = await this.findByCoopnameAndCategoryId(coopname, categoryId);
    if (existing) {
      // Если существует, но неактивна - активируем
      if (!existing.isActive) {
        const activated = existing.activate();
        return this.save(activated);
      }
      return existing;
    }

    // Создаем новую запись для всей категории (typeId = null)
    const newAvailableCategory = new AvailableCategoryDomainEntity({
      coopname,
      categoryId,
      typeId: undefined, // null означает всю категорию
      addedBy,
      isActive: true,
    });

    return this.save(newAvailableCategory);
  }

  async addCategoryType(
    coopname: string,
    categoryId: number,
    typeId: number,
    addedBy: string
  ): Promise<AvailableCategoryDomainEntity> {
    // Проверяем, не существует ли уже такая запись
    const existing = await this.findByCoopnameAndCategoryId(coopname, categoryId, typeId);
    if (existing) {
      // Если существует, но неактивна - активируем
      if (!existing.isActive) {
        const activated = existing.activate();
        return this.save(activated);
      }
      return existing;
    }

    // Создаем новую запись для конкретного типа
    const newAvailableCategory = new AvailableCategoryDomainEntity({
      coopname,
      categoryId,
      typeId,
      addedBy,
      isActive: true,
    });

    return this.save(newAvailableCategory);
  }

  async removeCategory(coopname: string, categoryId: number): Promise<void> {
    // Удаляем все записи для категории (включая конкретные типы)
    await this.availableCategoryRepository.delete({ coopname, categoryId });
  }

  async removeCategoryType(coopname: string, categoryId: number, typeId: number): Promise<void> {
    await this.availableCategoryRepository.delete({ coopname, categoryId, typeId });
  }

  async getAvailableCategoryIds(coopname: string): Promise<number[]> {
    // только целые категории
    const entities = await this.availableCategoryRepository.find({ coopname, isActive: true, typeId: isNull() });
    return entities.map((entity) => entity.categoryId);
  }

  async getAvailableTypeIds(coopname: string, categoryId: number): Promise<number[]> {
    // только конкретные типы
    const entities = await this.availableCategoryRepository.find({ coopname, categoryId, isActive: true, typeId: notNull() });
    return entities.map((entity) => entity.typeId!).filter((id) => id !== undefined);
  }

  async isCategoryAvailable(coopname: string, categoryId: number): Promise<boolean> {
    // Категория доступна если есть правило для всей категории ИЛИ есть хотя бы один доступный тип
    const entities = await this.availableCategoryRepository.find({ coopname, categoryId, isActive: true });
    return entities.length > 0;
  }

  async isTypeAvailable(coopname: string, categoryId: number, typeId: number): Promise<boolean> {
    // Тип доступен если:
    // 1. Есть правило для всей категории (typeId = null)
    // 2. Есть конкретное правило для этого типа
    const entities = await this.availableCategoryRepository.find([
        { coopname, categoryId, isActive: true, typeId: isNull() }, // вся категория
        { coopname, categoryId, typeId, isActive: true }, // конкретный тип
      ]);
    return entities.length > 0;
  }

  async countByCoopname(coopname: string): Promise<number> {
    return this.availableCategoryRepository.count({ coopname, isActive: true });
  }

  async findByCategoryId(coopname: string, categoryId: number): Promise<AvailableCategoryDomainEntity[]> {
    const entities = await this.availableCategoryRepository.find({ coopname, categoryId }, { order: { createdAt: 'DESC' } });
    return AvailableCategoryMapper.toDomainArray(entities);
  }

  async updateStatus(coopname: string, categoryIds: number[], isActive: boolean, typeId?: number): Promise<void> {
    const whereCondition: any = {
      coopname,
      categoryId: oneOf(categoryIds),
    };

    if (typeId !== undefined) {
      whereCondition.typeId = typeId;
    }

    await this.availableCategoryRepository.update(whereCondition, { isActive, updatedAt: new Date() });
  }
}
