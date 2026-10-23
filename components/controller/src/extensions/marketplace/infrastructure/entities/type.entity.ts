import { CategoryEntity } from './category.entity';

export class TypeEntity {
  typeId!: number;

  typeName!: string;

  disabled!: boolean;

  descriptionCategoryId!: number;

  category!: CategoryEntity;

  createdAt!: Date;

  updatedAt!: Date;
}
