import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { AvailableCategoryDomainRepository } from '../../domain/repositories/available-category-domain.repository';
import { AvailableCategoryDomainEntity } from '../../domain/entities/available-category-domain.entity';
import { AvailableCategoryEntity } from '../entities/available-category.entity';
import { AvailableCategoryMapper } from '../mappers/available-category.mapper';

@Injectable()
export class AvailableCategoryRepositoryAdapter implements AvailableCategoryDomainRepository {
  constructor(
    @InjectRepository(AvailableCategoryEntity, 'marketplace')
    private readonly availableCategoryRepository: Repository<AvailableCategoryEntity>
  ) {}

  async findByCoopname(coopname: string): Promise<AvailableCategoryDomainEntity[]> {
    const entities = await this.availableCategoryRepository.find({
      where: { coopname },
      order: { createdAt: 'DESC' },
    });
    return AvailableCategoryMapper.toDomainArray(entities);
  }

  async findActiveByCoopname(coopname: string): Promise<AvailableCategoryDomainEntity[]> {
    const entities = await this.availableCategoryRepository.find({
      where: { coopname, isActive: true },
      order: { createdAt: 'DESC' },
    });
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
      whereCondition.typeId = IsNull();
    }

    const entity = await this.availableCategoryRepository.findOne({
      where: whereCondition,
    });
    return entity ? AvailableCategoryMapper.toDomain(entity) : null;
  }

  async save(availableCategory: AvailableCategoryDomainEntity): Promise<AvailableCategoryDomainEntity> {
    const entity = AvailableCategoryMapper.toEntity(availableCategory);
    const saved = await this.availableCategoryRepository.save(entity);
    return AvailableCategoryMapper.toDomain(saved);
  }

  async saveMany(availableCategories: AvailableCategoryDomainEntity[]): Promise<AvailableCategoryDomainEntity[]> {
    const entities = AvailableCategoryMapper.toEntityArray(availableCategories);
    const saved = await this.availableCategoryRepository.save(entities);
    return AvailableCategoryMapper.toDomainArray(saved);
  }

  async delete(id: number): Promise<void> {
    await this.availableCategoryRepository.delete(id);
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
    const entities = await this.availableCategoryRepository.find({
      where: { coopname, isActive: true, typeId: IsNull() }, // только целые категории
      select: ['categoryId'],
    });
    return entities.map((entity) => entity.categoryId);
  }

  async getAvailableTypeIds(coopname: string, categoryId: number): Promise<number[]> {
    const entities = await this.availableCategoryRepository.find({
      where: {
        coopname,
        categoryId,
        isActive: true,
        typeId: Not(IsNull()), // только конкретные типы
      },
      select: ['typeId'],
    });
    return entities.map((entity) => entity.typeId!).filter((id) => id !== undefined);
  }

  async isCategoryAvailable(coopname: string, categoryId: number): Promise<boolean> {
    // Категория доступна если есть правило для всей категории ИЛИ есть хотя бы один доступный тип
    const entities = await this.availableCategoryRepository.find({
      where: { coopname, categoryId, isActive: true },
    });
    return entities.length > 0;
  }

  async isTypeAvailable(coopname: string, categoryId: number, typeId: number): Promise<boolean> {
    // Тип доступен если:
    // 1. Есть правило для всей категории (typeId = null)
    // 2. Есть конкретное правило для этого типа
    const entities = await this.availableCategoryRepository.find({
      where: [
        { coopname, categoryId, isActive: true, typeId: IsNull() }, // вся категория
        { coopname, categoryId, typeId, isActive: true }, // конкретный тип
      ],
    });
    return entities.length > 0;
  }

  async countByCoopname(coopname: string): Promise<number> {
    return this.availableCategoryRepository.count({
      where: { coopname, isActive: true },
    });
  }

  async findByCategoryId(coopname: string, categoryId: number): Promise<AvailableCategoryDomainEntity[]> {
    const entities = await this.availableCategoryRepository.find({
      where: { coopname, categoryId },
      order: { createdAt: 'DESC' },
    });
    return AvailableCategoryMapper.toDomainArray(entities);
  }

  async updateStatus(coopname: string, categoryIds: number[], isActive: boolean, typeId?: number): Promise<void> {
    const whereCondition: any = {
      coopname,
      categoryId: In(categoryIds),
    };

    if (typeId !== undefined) {
      whereCondition.typeId = typeId;
    }

    await this.availableCategoryRepository.update(whereCondition, { isActive, updatedAt: new Date() });
  }
}
