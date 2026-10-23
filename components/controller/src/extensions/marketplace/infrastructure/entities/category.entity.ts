import { TypeEntity } from './type.entity';

export class CategoryEntity {
  descriptionCategoryId!: number;

  categoryName!: string;

  disabled!: boolean;

  parentId?: number;

  parent?: CategoryEntity;

  children!: CategoryEntity[];

  types!: TypeEntity[];

  createdAt!: Date;

  updatedAt!: Date;
}
