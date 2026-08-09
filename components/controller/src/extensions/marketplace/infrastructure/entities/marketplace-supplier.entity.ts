import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Реестр поставщиков «Стола заказов» (PG, без on-chain).
 *
 * Заменяет таблицу whitelist: теперь все поставщики проходят через реестр и
 * допускаются к публикации поставок только при `status='approved'`. Сам
 * кооператив (перепоставка остатков, FR5) поставщиком в реестре не числится —
 * его право публиковать выводится по равенству `member_account === coopname`
 * в `isOfferer`, отдельная запись не нужна.
 *
 * Договор поставщика — внешний документ (бумажный по членской модели /
 * электронный ДУХД по боевой). В записи держим реквизиты (номер + дата) и,
 * на будущее, ссылку на сам документ; в назначение платежа выплаты идёт
 * «Оплата по договору № <contract_number> от <contract_date>».
 */
@Entity({ name: 'marketplace_supplier' })
@Unique('uq_marketplace_supplier_member', ['coopname', 'member_account'])
@Index(['coopname'])
export class MarketplaceSupplierEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public member_account!: string;

  @Column({ type: 'varchar', length: 32 })
  public model!: string;

  @Column({ type: 'varchar', length: 32 })
  public status!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  public contract_number!: string | null;

  @Column({ type: 'date', nullable: true })
  public contract_date!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  public contract_document_url!: string | null;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public requested_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  public requested_at!: Date;

  @Column({ type: 'varchar', length: 13, nullable: true })
  public reviewed_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  public reviewed_at!: Date | null;
}
