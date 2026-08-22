import { Inject, Injectable } from '@nestjs/common';
import { CategoryDomainEntity } from '../entities/category-domain.entity';
import type { TypeDomainEntity } from '../entities/type-domain.entity';
import { CategoryDomainRepository, CATEGORY_DOMAIN_REPOSITORY } from '../repositories/category-domain.repository';
import { TypeDomainRepository, TYPE_DOMAIN_REPOSITORY } from '../repositories/type-domain.repository';
import { AvailableCategoryDomainService, AVAILABLE_CATEGORY_DOMAIN_SERVICE } from './available-category-domain.service';
import { platformSettings } from '@coopenomics/extension-kit';

/**
 * Доменный сервис для работы с деревом категорий и типов товаров
 */
@Injectable()
export class CategoryTreeDomainService {
  constructor(
    @Inject(CATEGORY_DOMAIN_REPOSITORY)
    private readonly categoryRepository: CategoryDomainRepository,
    @Inject(TYPE_DOMAIN_REPOSITORY)
    private readonly typeRepository: TypeDomainRepository,
    @Inject(AVAILABLE_CATEGORY_DOMAIN_SERVICE)
    private readonly availableCategoryService: AvailableCategoryDomainService
  ) {}

  /**
   * Построить полное дерево категорий с типами товаров
   */
  async buildCategoryTree(): Promise<CategoryDomainEntity[]> {
    // Загружаем все категории сразу для эффективности
    const allCategories = await this.categoryRepository.findAll();
    const categoryMap = new Map<number, CategoryDomainEntity>();

    // Создаем мапу категорий
    allCategories.forEach((cat) => categoryMap.set(cat.descriptionCategoryId, cat));

    // Устанавливаем parent связи
    allCategories.forEach((category) => {
      if (category.parentId && categoryMap.has(category.parentId)) {
        (category as any).parent = categoryMap.get(category.parentId);
      }
    });

    const rootCategories = allCategories.filter((cat) => !cat.parentId);

    // Рекурсивно строим дерево для каждой корневой категории
    for (const category of rootCategories) {
      await this.buildCategorySubtreeOptimized(category, allCategories);
    }

    return rootCategories;
  }

  /**
   * Построить дерево категорий начиная с конкретной категории
   */
  async buildCategoryTreeFromRoot(rootCategoryId: number): Promise<CategoryDomainEntity[]> {
    // Загружаем все категории для построения полного parent chain
    const allCategories = await this.categoryRepository.findAll();
    const categoryMap = new Map<number, CategoryDomainEntity>();

    // Создаем мапу категорий
    allCategories.forEach((cat) => categoryMap.set(cat.descriptionCategoryId, cat));

    // Устанавливаем parent связи
    allCategories.forEach((category) => {
      if (category.parentId && categoryMap.has(category.parentId)) {
        (category as any).parent = categoryMap.get(category.parentId);
      }
    });

    const rootCategory = categoryMap.get(rootCategoryId);
    if (!rootCategory) {
      return [];
    }

    // Строим поддерево для указанной корневой категории
    await this.buildCategorySubtreeOptimized(rootCategory, allCategories);

    return [rootCategory];
  }

  /**
   * Оптимизированная версия построения поддерева
   */
  private async buildCategorySubtreeOptimized(
    category: CategoryDomainEntity,
    allCategories: CategoryDomainEntity[]
  ): Promise<void> {
    // Находим дочерние категории из уже загруженного списка
    const children = allCategories.filter((cat) => cat.parentId === category.descriptionCategoryId);
    (category as any).children = children;

    // Загружаем типы товаров для текущей категории
    const types = await this.typeRepository.findByCategoryId(category.descriptionCategoryId);
    (category as any).types = types;

    // Рекурсивно обрабатываем дочерние категории
    for (const child of children) {
      await this.buildCategorySubtreeOptimized(child, allCategories);
    }
  }

  /**
   * Рекурсивно построить поддерево для категории (старая версия - оставляем для совместимости)
   */
  private async buildCategorySubtree(category: CategoryDomainEntity): Promise<void> {
    // Загружаем дочерние категории
    const children = await this.categoryRepository.findByParentId(category.descriptionCategoryId);

    // Устанавливаем parent для корректного построения fullPath
    // Загружаем полную категорию с parent chain для каждого ребенка
    for (const child of children) {
      const fullChild = await this.categoryRepository.findById(child.descriptionCategoryId);
      if (fullChild) {
        // Заменяем child полной версией с parent chain
        Object.assign(child, fullChild);
      }
    }

    (category as any).children = children;

    // Загружаем типы товаров для текущей категории
    const types = await this.typeRepository.findByCategoryId(category.descriptionCategoryId);
    (category as any).types = types;

    // Рекурсивно обрабатываем дочерние категории
    for (const child of children) {
      await this.buildCategorySubtree(child);
    }
  }

  /**
   * Найти все листовые категории (где можно создавать товары)
   */
  async findLeafCategories(): Promise<CategoryDomainEntity[]> {
    const allCategories = await this.categoryRepository.findAll();

    return allCategories.filter((category) => {
      // Листовая категория = нет дочерних категорий и не отключена
      const hasChildren = allCategories.some((c) => c.parentId === category.descriptionCategoryId);
      return !hasChildren && !category.disabled;
    });
  }

  /**
   * Найти категорию с полным путем
   */
  async findCategoryWithPath(categoryId: number): Promise<{
    category: CategoryDomainEntity;
    path: CategoryDomainEntity[];
  } | null> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) return null;

    const path: CategoryDomainEntity[] = [];
    let current: CategoryDomainEntity | null = category;

    // Строим путь от текущей категории к корню
    while (current) {
      path.unshift(current);
      if (current.parentId) {
        current = await this.categoryRepository.findById(current.parentId);
      } else {
        current = null;
      }
    }

    return { category, path };
  }

  /**
   * Получить статистику по дереву категорий
   */
  async getCategoryTreeStats(): Promise<{
    totalCategories: number;
    rootCategories: number;
    leafCategories: number;
    disabledCategories: number;
    totalTypes: number;
    availableTypes: number;
  }> {
    const [totalCategories, rootCategories, leafCategories, allCategories, totalTypes, availableTypes] = await Promise.all([
      this.categoryRepository.count(),
      this.categoryRepository.findRootCategories().then((cats) => cats.length),
      this.findLeafCategories().then((cats) => cats.length),
      this.categoryRepository.findAll(),
      this.typeRepository.count(),
      this.typeRepository.findAvailable().then((types) => types.length),
    ]);

    const disabledCategories = allCategories.filter((c) => c.disabled).length;

    return {
      totalCategories,
      rootCategories,
      leafCategories,
      disabledCategories,
      totalTypes,
      availableTypes,
    };
  }

  /**
   * Получить все типы товаров для категории и её подкатегорий
   */
  async getTypesForCategoryTree(categoryId: number): Promise<TypeDomainEntity[]> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) return [];

    const allCategories = await this.categoryRepository.findAll();
    const categoryIds = this.getAllDescendantIds(categoryId, allCategories);
    categoryIds.push(categoryId); // Включаем саму категорию

    const allTypes: TypeDomainEntity[] = [];
    for (const id of categoryIds) {
      const types = await this.typeRepository.findByCategoryId(id);
      allTypes.push(...types);
    }

    return allTypes;
  }

  /**
   * Получить ID всех потомков категории
   */
  private getAllDescendantIds(categoryId: number, allCategories: CategoryDomainEntity[]): number[] {
    const descendants: number[] = [];
    const children = allCategories.filter((c) => c.parentId === categoryId);

    for (const child of children) {
      descendants.push(child.descriptionCategoryId);
      descendants.push(...this.getAllDescendantIds(child.descriptionCategoryId, allCategories));
    }

    return descendants;
  }

  /**
   * Поиск по дереву категорий и типов товаров
   * Универсальный метод поиска - возвращает дерево категорий на основе поискового запроса
   */
  async search(searchTerm: string): Promise<CategoryDomainEntity[]> {
    const lowerSearchTerm = searchTerm.toLowerCase().trim();

    if (!lowerSearchTerm) {
      return [];
    }

    // ИСПРАВЛЕНИЕ: Загружаем ВСЕ данные ОДИН РАЗ в начале
    const [allCategories, allTypes] = await Promise.all([this.categoryRepository.findAll(), this.typeRepository.findAll()]);

    const categoryMap = new Map<number, CategoryDomainEntity>();
    allCategories.forEach((cat) => categoryMap.set(cat.descriptionCategoryId, cat));

    // Используем оптимизированные методы поиска
    const [matchedCategories, matchedTypes] = await Promise.all([
      this.categoryRepository.searchByName(lowerSearchTerm, 100),
      this.typeRepository.searchByName(lowerSearchTerm, 100),
    ]);

    // Собираем все relevant категории (найденные + их родители + категории найденных типов)
    const relevantCategoryIds = new Set<number>();

    // Добавляем найденные категории и их путь к корню
    for (const category of matchedCategories) {
      this.addCategoryPathToRootOptimized(category.descriptionCategoryId, categoryMap, relevantCategoryIds);
    }

    // Добавляем категории найденных типов и их путь к корню
    for (const type of matchedTypes) {
      this.addCategoryPathToRootOptimized(type.descriptionCategoryId, categoryMap, relevantCategoryIds);
    }

    // Строим результирующее дерево из relevant категорий
    const resultTree = await this.buildFilteredCategoryTree(relevantCategoryIds, allCategories, allTypes, lowerSearchTerm);

    return resultTree;
  }

  /**
   * ОПТИМИЗИРОВАННАЯ версия добавления пути к корню
   * Использует Map вместо поиска в массиве
   */
  private addCategoryPathToRootOptimized(
    categoryId: number,
    categoryMap: Map<number, CategoryDomainEntity>,
    relevantCategoryIds: Set<number>
  ): void {
    let currentId: number | undefined = categoryId;

    while (currentId !== undefined) {
      relevantCategoryIds.add(currentId);
      const category = categoryMap.get(currentId);
      currentId = category?.parentId;
    }
  }

  /**
   * Строит отфильтрованное дерево категорий на основе relevant категорий
   */
  private async buildFilteredCategoryTree(
    relevantCategoryIds: Set<number>,
    allCategories: CategoryDomainEntity[],
    allTypes: TypeDomainEntity[],
    searchTerm: string
  ): Promise<CategoryDomainEntity[]> {
    // Фильтруем только relevant категории
    const relevantCategories = allCategories.filter((cat) => relevantCategoryIds.has(cat.descriptionCategoryId));

    // Находим корневые категории среди relevant
    const rootCategories = relevantCategories.filter((cat) => !cat.parentId);

    // Рекурсивно строим дерево
    const resultTree: CategoryDomainEntity[] = [];
    for (const rootCategory of rootCategories) {
      const builtCategory = await this.buildFilteredCategorySubtree(rootCategory, relevantCategories, allTypes, searchTerm);
      if (builtCategory) {
        resultTree.push(builtCategory);
      }
    }

    return resultTree;
  }

  /**
   * Рекурсивно строит поддерево для отфильтрованной категории
   */
  private async buildFilteredCategorySubtree(
    category: CategoryDomainEntity,
    relevantCategories: CategoryDomainEntity[],
    allTypes: TypeDomainEntity[],
    searchTerm: string
  ): Promise<CategoryDomainEntity | null> {
    // Находим дочерние категории среди relevant
    const relevantChildren = relevantCategories.filter((child) => child.parentId === category.descriptionCategoryId);

    // Рекурсивно строим дочерние категории
    const builtChildren: CategoryDomainEntity[] = [];
    for (const child of relevantChildren) {
      const builtChild = await this.buildFilteredCategorySubtree(child, relevantCategories, allTypes, searchTerm);
      if (builtChild) {
        builtChildren.push(builtChild);
      }
    }

    // Находим types для этой категории, отфильтрованные по поиску
    const categoryTypes = allTypes.filter((type) => {
      return (
        type.descriptionCategoryId === category.descriptionCategoryId &&
        (type.typeName.toLowerCase().includes(searchTerm) || category.categoryName.toLowerCase().includes(searchTerm))
      );
    });

    // Возвращаем категорию только если у неё есть дочерние элементы или типы
    if (builtChildren.length > 0 || categoryTypes.length > 0 || category.categoryName.toLowerCase().includes(searchTerm)) {
      // Создаем новую категорию с отфильтрованными данными
      return new CategoryDomainEntity({
        descriptionCategoryId: category.descriptionCategoryId,
        categoryName: category.categoryName,
        disabled: category.disabled,
        parentId: category.parentId,
        parent: category.parent,
        children: builtChildren,
        types: categoryTypes,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      });
    }

    return null;
  }

  /**
   * Получить все корневые категории
   */
  async getRootCategories(): Promise<CategoryDomainEntity[]> {
    const rootCategories = await this.categoryRepository.findRootCategories();

    // Загружаем типы для каждой корневой категории
    for (const category of rootCategories) {
      const types = await this.typeRepository.findByCategoryId(category.descriptionCategoryId);
      (category as any).types = types;
    }

    return rootCategories;
  }

  /**
   * Получить категорию по ID
   */
  async getCategoryById(categoryId: number): Promise<CategoryDomainEntity | null> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) return null;

    // Загружаем типы товаров для категории
    const types = await this.typeRepository.findByCategoryId(categoryId);
    (category as any).types = types;
    (category as any).children = []; // Пустые дети для простого получения категории

    return category;
  }

  /**
   * Получить тип товара по ID
   */
  async getTypeById(typeId: number): Promise<TypeDomainEntity | null> {
    return this.typeRepository.findById(typeId);
  }

  /**
   * Построить дерево категорий с опциями
   */
  async buildCategoryTreeWithOptions(options?: {
    rootCategoryId?: number;
    onlyAvailable?: boolean;
    includeTypes?: boolean;
    maxDepth?: number;
    coopname?: string;
  }): Promise<CategoryDomainEntity[]> {
    let domainTree: CategoryDomainEntity[];

    // Строим базовое дерево
    if (options?.rootCategoryId) {
      domainTree = await this.buildCategoryTreeFromRoot(options.rootCategoryId);
    } else {
      domainTree = await this.buildCategoryTree();
    }

    // Применяем фильтрацию по доступности
    if (options?.onlyAvailable) {
      domainTree = await this.filterCategoriesByAvailability(domainTree, options.coopname);
    }

    // Исключаем типы товаров если нужно
    if (options?.includeTypes === false) {
      domainTree = this.removeTypesFromCategoryTree(domainTree);
    }

    // Ограничиваем глубину дерева если указано
    if (options?.maxDepth && options.maxDepth > 0) {
      domainTree = this.limitCategoryTreeDepth(domainTree, options.maxDepth);
    }

    return domainTree;
  }

  /**
   * Убрать типы товаров из дерева категорий (доменная логика)
   */
  private removeTypesFromCategoryTree(categories: CategoryDomainEntity[]): CategoryDomainEntity[] {
    return categories.map((category) => {
      const processedChildren =
        category.children && category.children.length > 0 ? this.removeTypesFromCategoryTree(category.children) : [];

      return new CategoryDomainEntity({
        descriptionCategoryId: category.descriptionCategoryId,
        categoryName: category.categoryName,
        disabled: category.disabled,
        parentId: category.parentId,
        parent: category.parent,
        children: processedChildren,
        types: [], // Убираем типы товаров
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      });
    });
  }

  /**
   * Ограничить глубину дерева категорий (доменная логика)
   */
  private limitCategoryTreeDepth(
    categories: CategoryDomainEntity[],
    maxDepth: number,
    currentDepth = 1
  ): CategoryDomainEntity[] {
    if (currentDepth >= maxDepth) {
      // Удаляем детей на максимальной глубине
      return categories.map((category) => {
        return new CategoryDomainEntity({
          descriptionCategoryId: category.descriptionCategoryId,
          categoryName: category.categoryName,
          disabled: category.disabled,
          parentId: category.parentId,
          parent: category.parent,
          children: [], // Убираем детей
          types: category.types,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        });
      });
    }

    return categories.map((category) => {
      const processedChildren =
        category.children && category.children.length > 0
          ? this.limitCategoryTreeDepth(category.children, maxDepth, currentDepth + 1)
          : category.children;

      return new CategoryDomainEntity({
        descriptionCategoryId: category.descriptionCategoryId,
        categoryName: category.categoryName,
        disabled: category.disabled,
        parentId: category.parentId,
        parent: category.parent,
        children: processedChildren,
        types: category.types,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      });
    });
  }

  /**
   * Фильтрация дерева категорий по доступности в кооперативе
   */
  async filterCategoriesByAvailability(
    categories: CategoryDomainEntity[],
    coopname?: string
  ): Promise<CategoryDomainEntity[]> {
    const currentCoopname = coopname || platformSettings().coopname;

    // Проверяем, есть ли ограничения в кооперативе
    const hasRestrictions = await this.availableCategoryService.hasAvailabilityRestrictions(currentCoopname);

    // Если нет ограничений, возвращаем все категории
    if (!hasRestrictions) {
      return categories;
    }

    // Рекурсивно фильтруем дерево с учетом типов товаров
    return this.filterCategoryTreeRecursive(categories, currentCoopname);
  }

  /**
   * Рекурсивная фильтрация дерева категорий с учетом типов товаров
   */
  private async filterCategoryTreeRecursive(
    categories: CategoryDomainEntity[],
    coopname: string
  ): Promise<CategoryDomainEntity[]> {
    const filteredCategories: CategoryDomainEntity[] = [];

    for (const category of categories) {
      // Проверяем доступность категории
      const isCategoryAvailable = await this.availableCategoryService.isCategoryAvailable(
        coopname,
        category.descriptionCategoryId
      );

      // Фильтруем типы товаров для этой категории
      const filteredTypes: any[] = [];
      for (const type of category.types) {
        const isTypeAvailable = await this.availableCategoryService.isTypeAvailable(
          coopname,
          category.descriptionCategoryId,
          type.typeId
        );
        if (isTypeAvailable) {
          filteredTypes.push(type);
        }
      }

      // Фильтруем дочерние категории
      const filteredChildren = await this.filterCategoryTreeRecursive(category.children, coopname);

      // Включаем категорию если:
      // 1. У неё есть доступные типы товаров
      // 2. У неё есть доступные дочерние категории
      // 3. Сама категория доступна (имеет правило для всей категории)
      const hasAvailableTypes = filteredTypes.length > 0;
      const hasAvailableChildren = filteredChildren.length > 0;

      if (hasAvailableTypes || hasAvailableChildren || isCategoryAvailable) {
        const filteredCategory = new CategoryDomainEntity({
          descriptionCategoryId: category.descriptionCategoryId,
          categoryName: category.categoryName,
          disabled: category.disabled,
          parentId: category.parentId,
          parent: category.parent,
          children: filteredChildren,
          types: filteredTypes,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
        });
        filteredCategories.push(filteredCategory);
      }
    }

    return filteredCategories;
  }

  /**
   * Построить дерево категорий с учетом доступности в кооперативе
   */
  async buildAvailableCategoryTree(coopname?: string): Promise<CategoryDomainEntity[]> {
    const fullTree = await this.buildCategoryTree();
    return this.filterCategoriesByAvailability(fullTree, coopname);
  }

  /**
   * Найти листовые категории с учетом доступности в кооперативе
   */
  async findAvailableLeafCategories(coopname?: string): Promise<CategoryDomainEntity[]> {
    const currentCoopname = coopname || platformSettings().coopname;
    const allLeafCategories = await this.findLeafCategories();

    // Проверяем, есть ли ограничения в кооперативе
    const hasRestrictions = await this.availableCategoryService.hasAvailabilityRestrictions(currentCoopname);

    // Если нет ограничений, возвращаем все листовые категории
    if (!hasRestrictions) {
      return allLeafCategories;
    }

    // Фильтруем по доступности
    const availableCategoryIds = await this.availableCategoryService.getAvailableCategoryIds(currentCoopname);
    return allLeafCategories.filter((category) => availableCategoryIds.includes(category.descriptionCategoryId));
  }
}

export const CATEGORY_TREE_DOMAIN_SERVICE = Symbol('CATEGORY_TREE_DOMAIN_SERVICE');
