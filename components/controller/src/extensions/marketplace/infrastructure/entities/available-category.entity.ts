import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('available_categories')
@Unique(['coopname', 'categoryId', 'typeId'])
@Index(['coopname', 'isActive'])
@Index(['coopname', 'categoryId'])
export class AvailableCategoryEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'coopname', type: 'varchar', length: 100 })
  coopname!: string;

  @Column({ name: 'category_id', type: 'integer' })
  categoryId!: number;

  @Column({ name: 'type_id', type: 'integer', nullable: true })
  typeId?: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'added_by', type: 'varchar', length: 100 })
  addedBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
