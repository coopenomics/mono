import { Entity, Column, Index, OneToMany } from 'typeorm';
import { ProjectStatus } from '../../domain/enums/project-status.enum';
import { IProjectDomainInterfaceBlockchainData } from '../../domain/interfaces/project-blockchain.interface';
import { IssueTypeormEntity } from './issue.typeorm-entity';
import { StoryTypeormEntity } from './story.typeorm-entity';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_projects';
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_hash`, ['project_hash'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_status`, ['status'])
export class ProjectTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (projects.hpp)
  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  project_hash!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  parent_hash!: string;

  @Column({ type: 'varchar', length: 20 })
  blockchain_status!: string;

  @Column({ type: 'boolean', default: false })
  is_opened!: boolean;

  @Column({ type: 'boolean', default: false })
  is_planed!: boolean;

  @Column({ type: 'boolean', default: false })
  is_authorized!: boolean;

  @Column({ type: 'varchar', length: 12 })
  master!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', nullable: true })
  invite!: string;

  @Column({ type: 'text', nullable: true })
  data!: string;

  @Column({ type: 'text', nullable: true })
  meta!: string;

  @Column({ type: 'json', nullable: true })
  authorization!: IProjectDomainInterfaceBlockchainData['authorization'];

  @Column({ type: 'json' })
  counts!: IProjectDomainInterfaceBlockchainData['counts'];

  @Column({ type: 'json' })
  plan!: IProjectDomainInterfaceBlockchainData['plan'];

  @Column({ type: 'json' })
  fact!: IProjectDomainInterfaceBlockchainData['fact'];

  @Column({ type: 'json' })
  crps!: IProjectDomainInterfaceBlockchainData['crps'];

  @Column({ type: 'json' })
  voting!: IProjectDomainInterfaceBlockchainData['voting'];

  @Column({ type: 'timestamp' })
  created_at!: Date;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PENDING,
  })
  status!: ProjectStatus;

  @Column({ type: 'varchar', length: 3 })
  prefix!: string;

  @Column({ type: 'integer', default: 0 })
  issue_counter!: number;

  @Column({ type: 'timestamp', nullable: true })
  voting_deadline!: Date | null;

  // Связи
  @OneToMany(() => IssueTypeormEntity, (issue) => issue.project, { cascade: true })
  issues!: IssueTypeormEntity[];

  @OneToMany(() => StoryTypeormEntity, (story) => story.project, { cascade: true })
  stories!: StoryTypeormEntity[];
}
