import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DictionaryEntity } from './dictionary.entity';
import { CategoryTypeAttributeEntity } from './category-type-attribute.entity';

@Entity('attributes')
export class AttributeEntity {
  @PrimaryColumn({ name: 'attribute_id' })
  attributeId!: number;

  @Column({ name: 'name', type: 'varchar', length: 500 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'type', type: 'varchar', length: 100 })
  type!: string;

  @Column({ name: 'is_collection', type: 'boolean', default: false })
  isCollection!: boolean;

  @Column({ name: 'is_required', type: 'boolean', default: false })
  isRequired!: boolean;

  @Column({ name: 'is_aspect', type: 'boolean', default: false })
  isAspect!: boolean;

  @Column({ name: 'max_value_count', type: 'integer', default: 0 })
  maxValueCount!: number;

  @Column({ name: 'group_name', type: 'varchar', length: 200, nullable: true })
  groupName?: string;

  @Column({ name: 'group_id', type: 'integer', nullable: true })
  groupId?: number;

  @Column({ name: 'dictionary_id', type: 'integer', nullable: true })
  dictionaryId?: number;

  @Column({ name: 'category_dependent', type: 'boolean', default: false })
  categoryDependent!: boolean;

  @Column({ name: 'complex_is_collection', type: 'boolean', default: false })
  complexIsCollection!: boolean;

  @Column({ name: 'attribute_complex_id', type: 'integer', default: 0 })
  attributeComplexId!: number;

  @ManyToOne(() => DictionaryEntity, (dictionary) => dictionary.attributes, { nullable: true })
  @JoinColumn({ name: 'dictionary_id' })
  dictionary?: DictionaryEntity;

  @OneToMany(() => CategoryTypeAttributeEntity, (cta) => cta.attribute)
  categoryTypeAttributes!: CategoryTypeAttributeEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
