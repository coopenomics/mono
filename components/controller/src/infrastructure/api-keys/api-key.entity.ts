import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  key_hash!: string;

  @Column({ type: 'varchar', length: 8 })
  key_prefix!: string;

  @Column({ type: 'varchar', length: 50 })
  created_by!: string;

  @Column({ type: 'jsonb', default: '["*"]' })
  allowed_operations!: string[];

  @Column({ type: 'timestamp', nullable: true })
  expires_at?: Date;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at?: Date;

  @CreateDateColumn()
  created_at!: Date;
}
