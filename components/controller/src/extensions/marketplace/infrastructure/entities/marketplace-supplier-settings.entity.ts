import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Настройки выплат поставщика стола заказов: на какие реквизиты (платёжный
 * метод ядра, раздел «Реквизиты» стола пайщика) поставщик получает выплаты
 * по актам приёма-передачи.
 *
 * Выбор глобальный для поставщика, а не per-Offer: смена банковского счёта
 * делается в одном месте и действует на все будущие выплаты — без обхода
 * каждой опубликованной карточки.
 */
@Entity({ name: 'marketplace_supplier_settings' })
@Index('IDX_marketplace_supplier_settings_member_unique', ['coopname', 'username'], {
  unique: true,
})
export class MarketplaceSupplierSettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public username!: string;

  /** method_id платёжного метода ядра; null — поставщик выбор не делал. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  public payout_method_id!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updated_at!: Date;
}
