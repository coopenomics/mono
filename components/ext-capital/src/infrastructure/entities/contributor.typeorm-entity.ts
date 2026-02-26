import { Entity, Column, CreateDateColumn, Index, ManyToMany, OneToMany } from 'typeorm';
import { ContributorStatus } from '../../domain/enums/contributor-status.enum';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';
import { IssueTypeormEntity } from './issue.typeorm-entity';
import { SegmentTypeormEntity } from './segment.typeorm-entity';
import { VoteTypeormEntity } from './vote.typeorm-entity';

export const EntityName = 'capital_contributors';

@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_hash`, ['contributor_hash'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
@Index(`idx_${EntityName}_display_name`, ['display_name'])
@Index(`idx_${EntityName}_coopname_username`, ['coopname', 'username'], { unique: true })
export class ContributorTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (contributors.hpp)
  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 12 })
  username!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  contributor_hash!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  blockchain_status?: string;

  @Column({ type: 'text', nullable: true })
  memo!: string;

  @Column({ type: 'boolean', default: false })
  is_external_contract!: boolean;

  @Column({ type: 'json', nullable: true })
  contract!: ISignedDocumentDomainInterface;

  @Column({ type: 'json', nullable: true })
  appendixes!: string[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  rate_per_hour!: string;

  @Column({ type: 'integer', nullable: true })
  hours_per_day!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  debt_amount!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  reward_per_share_last!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contributed_as_investor!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contributed_as_creator!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contributed_as_author!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contributed_as_coordinator!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contributed_as_contributor!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contributed_as_propertor!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  // Поля геймификации
  @Column({ type: 'integer', nullable: true })
  level!: number;

  @Column({ type: 'float', nullable: true })
  energy!: number;

  @Column({ type: 'timestamp', nullable: true })
  last_energy_update!: Date;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: ContributorStatus,
    default: ContributorStatus.UNDEFINED,
  })
  status!: ContributorStatus;

  // Поля для отображения информации об аккаунте
  @Column({ type: 'varchar', length: 255 })
  display_name!: string; // ФИО или название организации

  @Column({ type: 'text', nullable: true })
  about!: string; // Описание участника

  // Поля для отслеживания пути регистрации
  @Column({ type: 'varchar', length: 50, nullable: true })
  program_key!: string; // Ключ выбранной программы (generation, capitalization)

  @Column({ type: 'varchar', length: 64, nullable: true })
  blagorost_offer_hash!: string; // Хеш оферты Благорост (если выбран путь Благороста)

  @Column({ type: 'varchar', length: 64, nullable: true })
  generator_offer_hash!: string; // Хеш оферты Генератор (если выбран путь Генератора)

  @Column({ type: 'varchar', length: 64, nullable: true })
  generation_contract_hash!: string; // Хеш договора УХД

  @Column({ type: 'varchar', length: 64, nullable: true })
  storage_agreement_hash!: string; // Хеш соглашения о хранении имущества

  @Column({ type: 'varchar', length: 64, nullable: true })
  blagorost_agreement_hash!: string; // Хеш соглашения Благорост (может быть заполнен из оферты или из соглашения)

  // Обратные связи
  @ManyToMany(() => IssueTypeormEntity, (issue) => issue.creators)
  issues!: IssueTypeormEntity[];

  @OneToMany(() => SegmentTypeormEntity, (segment) => segment.contributor)
  segments!: SegmentTypeormEntity[];

  @OneToMany(() => VoteTypeormEntity, (vote) => vote.recipient_contributor)
  votes_received!: VoteTypeormEntity[]; // Голоса полученные этим участником

  @OneToMany(() => VoteTypeormEntity, (vote) => vote.voter_contributor)
  votes_cast!: VoteTypeormEntity[]; // Голоса отданные этим участником
}
