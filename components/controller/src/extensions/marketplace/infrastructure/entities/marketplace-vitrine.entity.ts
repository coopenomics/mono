import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Story 3.1: витрина Стола заказов.
 *
 * В MVP — одна дефолтная запись `{id:'default', is_default:true}` на
 * coopname; конструктор кастомных витрин Out-of-MVP. Записи живут
 * как конфигурация (нет on-chain представления), `synchronize:true` в
 * `MarketplaceInfrastructureModule` создаёт таблицу.
 */
@Entity({ name: 'marketplace_vitrine' })
@Index(['coopname', 'is_default'])
export class MarketplaceVitrineEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 200 })
  public display_name!: string;

  @Column({ type: 'boolean', default: false })
  public is_default!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
