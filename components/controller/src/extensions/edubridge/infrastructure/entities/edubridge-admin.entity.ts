import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Администраторы приложения, назначенные владельцем. Контакты пайщиков им не видны. */
@Entity({ name: 'edubridge_admins' })
@Index('IDX_edubridge_admins_unique', ['coopname', 'username'], { unique: true })
export class EdubridgeAdminEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public username!: string;

  @Column({ type: 'varchar', length: 13 })
  public appointed_by!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;
}
