import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TypeEntity } from './type.entity';

@Entity('categories')
export class CategoryEntity {
  @PrimaryColumn({ name: 'description_category_id' })
  descriptionCategoryId!: number;

  @Column({ name: 'category_name', type: 'varchar', length: 500 })
  categoryName!: string;

  @Column({ name: 'disabled', type: 'boolean', default: false })
  disabled!: boolean;

  @Column({ name: 'parent_id', nullable: true })
  parentId?: number;

  @ManyToOne(() => CategoryEntity, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: CategoryEntity;

  @OneToMany(() => CategoryEntity, (category) => category.parent)
  children!: CategoryEntity[];

  @OneToMany(() => TypeEntity, (type) => type.category, { cascade: true })
  types!: TypeEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
