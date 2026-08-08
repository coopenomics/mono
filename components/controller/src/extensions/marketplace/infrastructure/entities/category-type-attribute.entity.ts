import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { CategoryEntity } from './category.entity';
import { TypeEntity } from './type.entity';
import { AttributeEntity } from './attribute.entity';

@Entity('category_type_attributes')
export class CategoryTypeAttributeEntity {
  @PrimaryColumn({ name: 'description_category_id' })
  descriptionCategoryId!: number;

  @PrimaryColumn({ name: 'type_id' })
  typeId!: number;

  @PrimaryColumn({ name: 'attribute_id' })
  attributeId!: number;

  @ManyToOne(() => CategoryEntity)
  @JoinColumn({ name: 'description_category_id' })
  category!: CategoryEntity;

  @ManyToOne(() => TypeEntity, (type) => type.categoryTypeAttributes)
  @JoinColumn({ name: 'type_id' })
  type!: TypeEntity;

  @ManyToOne(() => AttributeEntity, (attribute) => attribute.categoryTypeAttributes)
  @JoinColumn({ name: 'attribute_id' })
  attribute!: AttributeEntity;

  @Column({ name: 'category_name', type: 'varchar', length: 500 })
  categoryName!: string;

  @Column({ name: 'type_name', type: 'varchar', length: 500 })
  typeName!: string;

  @Column({ name: 'is_fetched', type: 'boolean', default: false })
  isFetched!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
