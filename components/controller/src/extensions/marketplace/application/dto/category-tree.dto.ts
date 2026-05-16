import { ObjectType, Field, Int } from '@nestjs/graphql';
import type { CategoryDomainEntity } from '../../domain/entities/category-domain.entity';
import type { TypeDomainEntity } from '../../domain/entities/type-domain.entity';

/**
 * GraphQL DTO для типа товара
 */
@ObjectType('MarketplaceProductType')
export class ProductTypeDTO {
  @Field(() => Int, { description: 'ID типа товара' })
  typeId!: number;

  @Field({ description: 'Название типа товара' })
  typeName!: string;

  @Field({ description: 'Признак отключения типа' })
  disabled!: boolean;

  @Field(() => Int, { description: 'ID категории' })
  descriptionCategoryId!: number;

  @Field({ description: 'Полное название с категорией', nullable: true })
  fullName?: string;

  @Field({ description: 'Доступен ли тип для создания товаров' })
  isAvailable!: boolean;

  constructor(data: {
    typeId: number;
    typeName: string;
    disabled: boolean;
    descriptionCategoryId: number;
    fullName?: string;
    isAvailable: boolean;
  }) {
    this.typeId = data.typeId;
    this.typeName = data.typeName;
    this.disabled = data.disabled;
    this.descriptionCategoryId = data.descriptionCategoryId;
    this.fullName = data.fullName;
    this.isAvailable = data.isAvailable;
  }

  /**
   * Создать DTO из доменной сущности
   */
  static fromDomain(entity: TypeDomainEntity): ProductTypeDTO {
    return new ProductTypeDTO({
      typeId: entity.typeId,
      typeName: entity.typeName,
      disabled: entity.disabled,
      descriptionCategoryId: entity.descriptionCategoryId,
      fullName: entity.getFullName(),
      isAvailable: entity.isAvailable(),
    });
  }
}

/**
 * GraphQL DTO для категории товаров
 */
@ObjectType('MarketplaceCategoryTreeNode')
export class CategoryDTO {
  @Field(() => Int, { description: 'ID категории' })
  descriptionCategoryId!: number;

  @Field({ description: 'Название категории' })
  categoryName!: string;

  @Field({ description: 'Признак отключения категории' })
  disabled!: boolean;

  @Field(() => Int, { description: 'ID родительской категории', nullable: true })
  parentId?: number;

  @Field(() => [CategoryDTO], { description: 'Дочерние категории' })
  children!: CategoryDTO[];

  @Field(() => [ProductTypeDTO], { description: 'Типы товаров в категории' })
  types!: ProductTypeDTO[];

  @Field({ description: 'Полный путь к категории', nullable: true })
  fullPath?: string;

  @Field({ description: 'Является ли категория листовой (можно создавать товары)' })
  isLeafCategory!: boolean;

  @Field(() => Int, { description: 'Количество дочерних категорий' })
  childrenCount!: number;

  @Field(() => Int, { description: 'Количество типов товаров' })
  typesCount!: number;

  constructor(data: {
    descriptionCategoryId: number;
    categoryName: string;
    disabled: boolean;
    parentId?: number;
    children: CategoryDTO[];
    types: ProductTypeDTO[];
    fullPath?: string;
    isLeafCategory: boolean;
  }) {
    this.descriptionCategoryId = data.descriptionCategoryId;
    this.categoryName = data.categoryName;
    this.disabled = data.disabled;
    this.parentId = data.parentId;
    this.children = data.children;
    this.types = data.types;
    this.fullPath = data.fullPath;
    this.isLeafCategory = data.isLeafCategory;
    this.childrenCount = data.children.length;
    this.typesCount = data.types.length;
  }

  /**
   * Создать DTO из доменной сущности
   */
  static fromDomain(entity: CategoryDomainEntity): CategoryDTO {
    return new CategoryDTO({
      descriptionCategoryId: entity.descriptionCategoryId,
      categoryName: entity.categoryName,
      disabled: entity.disabled,
      parentId: entity.parentId,
      children: entity.children.map((child) => CategoryDTO.fromDomain(child)),
      types: entity.types.map((type) => ProductTypeDTO.fromDomain(type)),
      fullPath: entity.getFullPath(),
      isLeafCategory: entity.isLeafCategory(),
    });
  }
}

/**
 * GraphQL DTO для статистики дерева категорий
 */
@ObjectType('MarketplaceCategoryTreeStats')
export class CategoryTreeStatsDTO {
  @Field(() => Int, { description: 'Общее количество категорий' })
  totalCategories!: number;

  @Field(() => Int, { description: 'Количество корневых категорий' })
  rootCategories!: number;

  @Field(() => Int, { description: 'Количество листовых категорий' })
  leafCategories!: number;

  @Field(() => Int, { description: 'Количество отключенных категорий' })
  disabledCategories!: number;

  @Field(() => Int, { description: 'Общее количество типов товаров' })
  totalTypes!: number;

  @Field(() => Int, { description: 'Количество доступных типов товаров' })
  availableTypes!: number;

  constructor(data: {
    totalCategories: number;
    rootCategories: number;
    leafCategories: number;
    disabledCategories: number;
    totalTypes: number;
    availableTypes: number;
  }) {
    this.totalCategories = data.totalCategories;
    this.rootCategories = data.rootCategories;
    this.leafCategories = data.leafCategories;
    this.disabledCategories = data.disabledCategories;
    this.totalTypes = data.totalTypes;
    this.availableTypes = data.availableTypes;
  }
}

/**
 * GraphQL DTO для результатов поиска по дереву
 */
@ObjectType('MarketplaceCategoryTreeSearchResult')
export class CategoryTreeSearchResultDTO {
  @Field(() => [CategoryDTO], { description: 'Найденные категории' })
  matchedCategories!: CategoryDTO[];

  @Field(() => [ProductTypeDTO], { description: 'Найденные типы товаров' })
  matchedTypes!: ProductTypeDTO[];

  @Field(() => [CategoryDTO], { description: 'Результирующее дерево категорий' })
  resultTree!: CategoryDTO[];

  @Field(() => Int, { description: 'Общее количество найденных элементов' })
  totalMatches!: number;

  constructor(data: { matchedCategories: CategoryDTO[]; matchedTypes: ProductTypeDTO[]; resultTree: CategoryDTO[] }) {
    this.matchedCategories = data.matchedCategories;
    this.matchedTypes = data.matchedTypes;
    this.resultTree = data.resultTree;
    this.totalMatches = data.matchedCategories.length + data.matchedTypes.length;
  }
}

/**
 * GraphQL DTO для товара с путем к категории
 */
@ObjectType('MarketplaceProductWithPath')
export class ProductWithPathDTO {
  @Field(() => ProductTypeDTO, { description: 'Тип товара' })
  type!: ProductTypeDTO;

  @Field(() => [CategoryDTO], { description: 'Путь к категории' })
  categoryPath!: CategoryDTO[];

  @Field({ description: 'Полный путь в виде строки' })
  fullPath!: string;

  constructor(data: { type: ProductTypeDTO; categoryPath: CategoryDTO[]; fullPath: string }) {
    this.type = data.type;
    this.categoryPath = data.categoryPath;
    this.fullPath = data.fullPath;
  }
}

/**
 * GraphQL DTO для категории с типами
 */
@ObjectType('MarketplaceCategoryWithTypes')
export class CategoryWithTypesDTO {
  @Field(() => CategoryDTO, { description: 'Категория' })
  category!: CategoryDTO;

  @Field(() => [ProductTypeDTO], { description: 'Найденные типы товаров в категории' })
  matchedTypes!: ProductTypeDTO[];

  @Field(() => [ProductTypeDTO], { description: 'Все типы товаров в категории' })
  allTypes!: ProductTypeDTO[];

  @Field(() => [CategoryDTO], { description: 'Путь к категории' })
  categoryPath!: CategoryDTO[];

  @Field(() => Int, { description: 'Количество найденных типов' })
  matchedTypesCount!: number;

  @Field(() => Int, { description: 'Общее количество типов' })
  totalTypesCount!: number;

  constructor(data: {
    category: CategoryDTO;
    matchedTypes: ProductTypeDTO[];
    allTypes: ProductTypeDTO[];
    categoryPath: CategoryDTO[];
  }) {
    this.category = data.category;
    this.matchedTypes = data.matchedTypes;
    this.allTypes = data.allTypes;
    this.categoryPath = data.categoryPath;
    this.matchedTypesCount = data.matchedTypes.length;
    this.totalTypesCount = data.allTypes.length;
  }
}
