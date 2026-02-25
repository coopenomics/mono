import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ShareTargetType {
  GUEST = 'guest',
  MEMBER = 'member',
}

@Entity('share_tokens')
export class ShareTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 50 })
  created_by!: string;

  @Column({ type: 'varchar', length: 255 })
  page_path!: string;

  @Column({ type: 'varchar', length: 255 })
  page_name!: string;

  @Column({ type: 'enum', enum: ShareTargetType })
  target_type!: ShareTargetType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  target_username?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  link_name?: string;

  @Column({ type: 'jsonb', default: '[]' })
  allowed_actions!: string[];

  @Column({ type: 'text' })
  token!: string;

  @Column({ type: 'timestamp', nullable: true })
  expires_at?: Date;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn()
  created_at!: Date;
}
