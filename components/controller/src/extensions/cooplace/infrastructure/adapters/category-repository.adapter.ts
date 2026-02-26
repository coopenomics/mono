import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CategoryDomainRepository } from '../../domain/repositories/category-domain.repository';
import { CategoryDomainEntity } from '../../domain/entities/category-domain.entity';
import { CategoryEntity } from '../entities/category.entity';
import { CategoryMapper } from '../mappers/category.mapper';

@Injectable()
export class CategoryRepositoryAdapter implements CategoryDomainRepository {
  constructor(
    @InjectRepository(CategoryEntity, 'marketplace')
    private readonly categoryRepository: Repository<CategoryEntity>
  ) {}

  async findAll(): Promise<CategoryDomainEntity[]> {
    const categories = await this.categoryRepository.find({
      relations: ['children', 'types', 'parent'],
    });
    return categories.map((cat) => CategoryMapper.toDomain(cat));
  }

  async findById(id: number): Promise<CategoryDomainEntity | null> {
    const category = await this.categoryRepository.findOne({
      where: { descriptionCategoryId: id },
      relations: ['children', 'types', 'parent'],
    });
    return category ? CategoryMapper.toDomain(category) : null;
  }

  async findRootCategories(): Promise<CategoryDomainEntity[]> {
    const categories = await this.categoryRepository.find({
      where: { parentId: IsNull() },
      relations: ['children', 'types'],
    });
    return categories.map((cat) => CategoryMapper.toDomain(cat));
  }

  async findByParentId(parentId: number): Promise<CategoryDomainEntity[]> {
    const categories = await this.categoryRepository.find({
      where: { parentId },
      relations: ['children', 'types'],
    });
    return categories.map((cat) => CategoryMapper.toDomain(cat));
  }

  async findWithHierarchy(): Promise<CategoryDomainEntity[]> {
    const query = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.children', 'children')
      .leftJoinAndSelect('children.children', 'grandchildren')
      .leftJoinAndSelect('grandchildren.children', 'greatgrandchildren')
      .leftJoinAndSelect('category.types', 'types')
      .where('category.parentId IS NULL')
      .orderBy('category.categoryName', 'ASC');

    const categories = await query.getMany();
    return categories.map((cat) => CategoryMapper.toDomain(cat));
  }

  async save(category: CategoryDomainEntity): Promise<CategoryDomainEntity> {
    const entity = CategoryMapper.toEntity(category);
    const saved = await this.categoryRepository.save(entity);
    return CategoryMapper.toDomain(saved);
  }

  async saveMany(categories: CategoryDomainEntity[]): Promise<CategoryDomainEntity[]> {
    const entities = categories.map((cat) => CategoryMapper.toEntity(cat));
    const saved = await this.categoryRepository.save(entities);
    return saved.map((cat) => CategoryMapper.toDomain(cat));
  }

  async upsert(categoryData: Partial<CategoryDomainEntity>): Promise<CategoryDomainEntity> {
    const existing = await this.categoryRepository.findOne({
      where: { descriptionCategoryId: categoryData.descriptionCategoryId },
    });

    if (existing) {
      Object.assign(existing, CategoryMapper.toEntityPartial(categoryData));
      const saved = await this.categoryRepository.save(existing);
      return CategoryMapper.toDomain(saved);
    } else {
      const entity = this.categoryRepository.create(CategoryMapper.toEntityPartial(categoryData));
      const saved = await this.categoryRepository.save(entity);
      return CategoryMapper.toDomain(saved);
    }
  }

  async count(): Promise<number> {
    return this.categoryRepository.count();
  }

  async findLeafCategories(): Promise<CategoryDomainEntity[]> {
    const query = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoin('category.children', 'children')
      .where('children.descriptionCategoryId IS NULL')
      .andWhere('category.disabled = false');

    const categories = await query.getMany();
    return categories.map((cat) => CategoryMapper.toDomain(cat));
  }

  async findByName(name: string): Promise<CategoryDomainEntity[]> {
    const categories = await this.categoryRepository.find({
      where: { categoryName: name },
      relations: ['children', 'types'],
    });
    return categories.map((cat) => CategoryMapper.toDomain(cat));
  }

  async findAvailable(): Promise<CategoryDomainEntity[]> {
    const categories = await this.categoryRepository.find({
      where: { disabled: false },
      relations: ['children', 'types'],
    });
    return categories.map((cat) => CategoryMapper.toDomain(cat));
  }

  async searchByName(searchTerm: string, limit = 50): Promise<CategoryDomainEntity[]> {
    const query = this.categoryRepository
      .createQueryBuilder('category')
      .where('LOWER(category.categoryName) LIKE LOWER(:searchTerm)', {
        searchTerm: `%${searchTerm}%`,
      })
      .orderBy('category.categoryName', 'ASC')
      .limit(limit);

    const categories = await query.getMany();
    return categories.map((cat) => CategoryMapper.toDomain(cat));
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
}
