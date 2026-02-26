import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Column } from 'typeorm';

export class BaseTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  _id!: string;

  @Column({ type: 'integer', nullable: true })
  block_num!: number;

  @Column({ type: 'boolean', default: true })
  present!: boolean;

  @Column({ type: 'varchar', nullable: true })
  status!: string;

  @CreateDateColumn({ type: 'timestamp' })
  _created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  _updated_at!: Date;
}
