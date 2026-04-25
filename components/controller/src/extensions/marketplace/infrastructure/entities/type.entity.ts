import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CategoryEntity } from './category.entity';
import { CategoryTypeAttributeEntity } from './category-type-attribute.entity';

@Entity('types')
export class TypeEntity {
  @PrimaryColumn({ name: 'type_id' })
  typeId!: number;

  @Column({ name: 'type_name', type: 'varchar', length: 500 })
  typeName!: string;

  @Column({ name: 'disabled', type: 'boolean', default: false })
  disabled!: boolean;

  @Column({ name: 'description_category_id' })
  descriptionCategoryId!: number;

  @ManyToOne(() => CategoryEntity, (category) => category.types)
  @JoinColumn({ name: 'description_category_id' })
  category!: CategoryEntity;

  @OneToMany(() => CategoryTypeAttributeEntity, (cta) => cta.type)
  categoryTypeAttributes!: CategoryTypeAttributeEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
