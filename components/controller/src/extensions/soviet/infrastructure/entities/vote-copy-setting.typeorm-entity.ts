import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('soviet_vote_copy_settings')
export class VoteCopySettingTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  coopname!: string;

  @Column()
  @Index()
  copier_username!: string;

  @Column()
  @Index()
  source_username!: string;

  @Column({ type: 'simple-array', default: '' })
  decision_types!: string[];

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ nullable: true })
  copyvote_public_key?: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
