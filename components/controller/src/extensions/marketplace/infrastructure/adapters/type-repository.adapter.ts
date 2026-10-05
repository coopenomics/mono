import { TableStore, ilike, oneOf } from '@coopenomics/extension-kit';
import { MARKETPLACE_CATALOG_CATEGORY_STORE, MARKETPLACE_CATALOG_TYPE_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
import { TypeDomainRepository } from '../../domain/repositories/type-domain.repository';
import { TypeDomainEntity } from '../../domain/entities/type-domain.entity';
import { CategoryDomainEntity } from '../../domain/entities/category-domain.entity';
import { TypeEntity } from '../entities/type.entity';
import { CategoryEntity } from '../entities/category.entity';
import { TypeMapper } from '../mappers/type.mapper';
import { CategoryMapper } from '../mappers/category.mapper';

/** Типы имущества справочника (таблица `types`) со своей категорией. */
@Injectable()
export class TypeRepositoryAdapter implements TypeDomainRepository {
  constructor(
    @Inject(MARKETPLACE_CATALOG_TYPE_STORE)
    private readonly typeRepository: TableStore<TypeEntity>,
    @Inject(MARKETPLACE_CATALOG_CATEGORY_STORE)
    private readonly categoryRepository: TableStore<CategoryEntity>
  ) {}

  async findAll(): Promise<TypeDomainEntity[]> {
    return this.toDomain(await this.typeRepository.find());
  }

  async findById(id: number): Promise<TypeDomainEntity | null> {
    const type = await this.typeRepository.findOne({ typeId: id });
    if (!type) return null;
    const [domain] = await this.toDomain([type]);
    return domain;
  }

  async findByCategoryId(categoryId: number): Promise<TypeDomainEntity[]> {
    return this.toDomain(await this.typeRepository.find({ descriptionCategoryId: categoryId }));
  }

  async findAvailable(): Promise<TypeDomainEntity[]> {
    return this.toDomain(await this.typeRepository.find({ disabled: false }));
  }

  async findByName(name: string): Promise<TypeDomainEntity[]> {
    return this.toDomain(await this.typeRepository.find({ typeName: ilike(`%${name}%`) }));
  }

  async save(type: TypeDomainEntity): Promise<TypeDomainEntity> {
    return TypeMapper.toDomain(await this.typeRepository.save(TypeMapper.toEntity(type)));
  }

  async saveMany(types: TypeDomainEntity[]): Promise<TypeDomainEntity[]> {
    const saved = await this.typeRepository.saveMany(types.map((type) => TypeMapper.toEntity(type)));
    return saved.map((type) => TypeMapper.toDomain(type));
  }

  async upsert(typeData: Partial<TypeDomainEntity>): Promise<TypeDomainEntity> {
    const { typeId, typeName, disabled, descriptionCategoryId } = typeData;
    return TypeMapper.toDomain(await this.typeRepository.save({ typeId, typeName, disabled, descriptionCategoryId }));
  }

  async count(): Promise<number> {
    return this.typeRepository.count();
  }

  /** Поиск по части названия без учёта регистра, по имени. */
  async searchByName(searchTerm: string, limit = 50): Promise<TypeDomainEntity[]> {
    return this.toDomain(await this.searchEntities(searchTerm, limit));
  }

  async searchByNameWithCategory(
    searchTerm: string,
    limit = 50
  ): Promise<
    {
      type: TypeDomainEntity;
      categoryPath: CategoryDomainEntity[];
      fullPath: string;
    }[]
  > {
    // Находим типы товаров по поисковому запросу с категорией
    const typeEntities = await this.searchEntities(searchTerm, limit);
    await this.attachCategory(typeEntities);
    const results: {
      type: TypeDomainEntity;
      categoryPath: CategoryDomainEntity[];
      fullPath: string;
    }[] = [];

    // Для каждого найденного типа строим путь к корню категории
    for (const typeEntity of typeEntities) {
      const type = TypeMapper.toDomain(typeEntity);
      const categoryPath: CategoryDomainEntity[] = [];
      let current: any = typeEntity.category;

      // Строим путь от категории типа к корню
      while (current) {
        const categoryDomain = CategoryMapper.toDomain(current);
        categoryPath.unshift(categoryDomain);

        if (current.parentId) {
          // Загружаем родительскую категорию
          current = await this.categoryRepository.findOne({ descriptionCategoryId: current.parentId });
        } else {
          current = null;
        }
      }

      const fullPath = categoryPath.map((cat) => cat.categoryName).join(' > ') + ` > ${type.typeName}`;

      results.push({
        type,
        categoryPath,
        fullPath,
      });
    }

    return results;
  }

  private searchEntities(searchTerm: string, limit: number): Promise<TypeEntity[]> {
    return this.typeRepository.find({ typeName: ilike(`%${searchTerm}%`) }, { order: { typeName: 'ASC' }, limit });
  }

  private async toDomain(types: TypeEntity[]): Promise<TypeDomainEntity[]> {
    await this.attachCategory(types);
    return types.map((type) => TypeMapper.toDomain(type));
  }

  /** Подгружает к типам их категории. */
  private async attachCategory(types: TypeEntity[]): Promise<void> {
    const ids = [...new Set(types.map((type) => type.descriptionCategoryId))];
    if (ids.length === 0) return;
    const categories = await this.categoryRepository.find({ descriptionCategoryId: oneOf(ids) });
    for (const type of types) {
      const category = categories.find((candidate) => candidate.descriptionCategoryId === type.descriptionCategoryId);
      if (category) type.category = category;
    }
  }
}
