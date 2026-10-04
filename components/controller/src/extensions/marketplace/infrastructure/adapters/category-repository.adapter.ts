import { TableStore, ilike, isNull, notNull, oneOf } from '@coopenomics/extension-kit';
import { MARKETPLACE_CATALOG_CATEGORY_STORE, MARKETPLACE_CATALOG_TYPE_STORE } from '../../infrastructure/database/marketplace-stores';
import { Inject, Injectable } from '@nestjs/common';
import { CategoryDomainRepository } from '../../domain/repositories/category-domain.repository';
import { CategoryDomainEntity } from '../../domain/entities/category-domain.entity';
import { CategoryEntity } from '../entities/category.entity';
import { TypeEntity } from '../entities/type.entity';
import { CategoryMapper } from '../mappers/category.mapper';

/** Какие связи категории подгрузить к записи. */
interface Related {
  children?: boolean;
  types?: boolean;
  parent?: boolean;
}

const idsOf = (categories: CategoryEntity[]): number[] => categories.map((category) => category.descriptionCategoryId);

/** Справочник категорий имущества (таблицы `categories`, `types`). */
@Injectable()
export class CategoryRepositoryAdapter implements CategoryDomainRepository {
  constructor(
    @Inject(MARKETPLACE_CATALOG_CATEGORY_STORE)
    private readonly categoryRepository: TableStore<CategoryEntity>,
    @Inject(MARKETPLACE_CATALOG_TYPE_STORE)
    private readonly typeRepository: TableStore<TypeEntity>
  ) {}

  async findAll(): Promise<CategoryDomainEntity[]> {
    return this.toDomain(await this.categoryRepository.find(), { children: true, types: true, parent: true });
  }

  async findById(id: number): Promise<CategoryDomainEntity | null> {
    const category = await this.categoryRepository.findOne({ descriptionCategoryId: id });
    if (!category) return null;
    const [domain] = await this.toDomain([category], { children: true, types: true, parent: true });
    return domain;
  }

  async findRootCategories(): Promise<CategoryDomainEntity[]> {
    return this.toDomain(await this.categoryRepository.find({ parentId: isNull() }), { children: true, types: true });
  }

  async findByParentId(parentId: number): Promise<CategoryDomainEntity[]> {
    return this.toDomain(await this.categoryRepository.find({ parentId }), { children: true, types: true });
  }

  /** Корневые категории по имени с тремя уровнями вложенных и своими типами. */
  async findWithHierarchy(): Promise<CategoryDomainEntity[]> {
    const roots = await this.categoryRepository.find({ parentId: isNull() }, { order: { categoryName: 'ASC' } });
    await this.attach(roots, { types: true });
    let level = roots;
    for (let depth = 0; depth < 3 && level.length > 0; depth += 1) {
      await this.attach(level, { children: true });
      level = level.flatMap((category) => category.children);
    }
    return roots.map((category) => CategoryMapper.toDomain(category));
  }

  async save(category: CategoryDomainEntity): Promise<CategoryDomainEntity> {
    const saved = await this.categoryRepository.save(CategoryMapper.toEntity(category));
    return CategoryMapper.toDomain(saved);
  }

  async saveMany(categories: CategoryDomainEntity[]): Promise<CategoryDomainEntity[]> {
    const saved = await this.categoryRepository.saveMany(categories.map((category) => CategoryMapper.toEntity(category)));
    return saved.map((category) => CategoryMapper.toDomain(category));
  }

  async upsert(categoryData: Partial<CategoryDomainEntity>): Promise<CategoryDomainEntity> {
    const saved = await this.categoryRepository.save(CategoryMapper.toEntityPartial(categoryData));
    return CategoryMapper.toDomain(saved);
  }

  async count(): Promise<number> {
    return this.categoryRepository.count();
  }

  /** Действующие категории без вложенных. */
  async findLeafCategories(): Promise<CategoryDomainEntity[]> {
    const parents = new Set((await this.categoryRepository.find({ parentId: notNull() })).map((category) => category.parentId));
    const enabled = await this.categoryRepository.find({ disabled: false });
    return enabled.filter((category) => !parents.has(category.descriptionCategoryId)).map((category) => CategoryMapper.toDomain(category));
  }

  async findByName(name: string): Promise<CategoryDomainEntity[]> {
    return this.toDomain(await this.categoryRepository.find({ categoryName: name }), { children: true, types: true });
  }

  async findAvailable(): Promise<CategoryDomainEntity[]> {
    return this.toDomain(await this.categoryRepository.find({ disabled: false }), { children: true, types: true });
  }

  /** Поиск по части названия без учёта регистра, по имени. */
  async searchByName(searchTerm: string, limit = 50): Promise<CategoryDomainEntity[]> {
    const categories = await this.categoryRepository.find(
      { categoryName: ilike(`%${searchTerm}%`) },
      { order: { categoryName: 'ASC' }, limit }
    );
    return categories.map((category) => CategoryMapper.toDomain(category));
  }

  async searchByNameWithPath(
    searchTerm: string,
    limit = 50
  ): Promise<
    {
      category: CategoryDomainEntity;
      path: CategoryDomainEntity[];
    }[]
  > {
    // Находим категории по поисковому запросу
    const matchedCategories = await this.searchByName(searchTerm, limit);

    const results: {
      category: CategoryDomainEntity;
      path: CategoryDomainEntity[];
    }[] = [];

    // Для каждой найденной категории строим путь к корню
    for (const category of matchedCategories) {
      const path: CategoryDomainEntity[] = [];
      let current: CategoryDomainEntity | null = category;

      // Строим путь от текущей категории к корню
      while (current) {
        path.unshift(current);
        if (current.parentId) {
          current = await this.findById(current.parentId);
        } else {
          current = null;
        }
      }

      results.push({ category, path });
    }

    return results;
  }

  private async toDomain(categories: CategoryEntity[], related: Related): Promise<CategoryDomainEntity[]> {
    await this.attach(categories, related);
    return categories.map((category) => CategoryMapper.toDomain(category));
  }

  /** Подгружает к записям их связи: вложенные категории, типы, родителя. */
  private async attach(categories: CategoryEntity[], related: Related): Promise<void> {
    if (categories.length === 0) return;
    const ids = idsOf(categories);
    if (related.children) {
      const children = await this.categoryRepository.find({ parentId: oneOf(ids) });
      for (const category of categories) {
        category.children = children.filter((child) => child.parentId === category.descriptionCategoryId);
      }
    }
    if (related.types) {
      const types = await this.typeRepository.find({ descriptionCategoryId: oneOf(ids) });
      for (const category of categories) {
        category.types = types.filter((type) => type.descriptionCategoryId === category.descriptionCategoryId);
      }
    }
    if (related.parent) {
      const parentIds = [...new Set(categories.map((category) => category.parentId).filter((id): id is number => id != null))];
      const parents = await this.categoryRepository.find({ descriptionCategoryId: oneOf(parentIds) });
      for (const category of categories) {
        category.parent = parents.find((parent) => parent.descriptionCategoryId === category.parentId);
      }
    }
  }
}
