import { Entity, Column, Index } from 'typeorm';
import { ProjectPropertyStatus } from '../../domain/enums/project-property-status.enum';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_project_properties';
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_property_hash`, ['property_hash'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_project_hash`, ['project_hash'])
@Index(`idx_${EntityName}_status`, ['status'])
export class ProjectPropertyTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (project_properties.hpp)
  @Column({ type: 'varchar' })
  coopname!: string;

  @Column({ type: 'varchar' })
  username!: string;

  @Column({ type: 'varchar' })
  blockchain_status!: string;

  @Column({ type: 'varchar' })
  project_hash!: string;

  @Column({ type: 'varchar' })
  property_hash!: string;

  @Column({ type: 'varchar' })
  property_amount!: string;

  @Column({ type: 'text' })
  property_description!: string;

  @Column({ type: 'timestamp' })
  created_at!: Date;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: ProjectPropertyStatus,
    default: ProjectPropertyStatus.CREATED,
  })
  status!: ProjectPropertyStatus;
}
