import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { CategoryEntity } from './category.entity';
import { TypeEntity } from './type.entity';
import { RequestAttributeValueEntity } from './request-attribute-value.entity';
import { RequestImageEntity } from './request-image.entity';

@Entity('marketplace_requests')
@Index(['coopname', 'status'])
@Index(['username', 'status'])
@Index(['type', 'status'])
@Index(['descriptionCategoryId', 'typeId'])
@Index(['hash'], { unique: true })
export class RequestEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'hash', type: 'varchar', length: 64, unique: true })
  @Index('idx_request_hash', { unique: true })
  hash!: string;

  @Column({ name: 'parent_hash', type: 'varchar', length: 64, nullable: true })
  @Index('idx_request_parent_hash')
  parentHash?: string;

  // Блокчейн поля
  @Column({ name: 'blockchain_id', type: 'varchar', length: 100, default: 'eos' })
  @Index('idx_request_blockchain_id')
  blockchainId!: string;

  @Column({ name: 'parent_id', type: 'integer', nullable: true })
  parentId?: number;

  @Column({ name: 'parent_username', type: 'varchar', length: 100, nullable: true })
  parentUsername?: string;

  @Column({ name: 'program_id', type: 'integer', default: 0 })
  programId!: number;

  // Финансовые поля из блокчейна
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, comment: 'Стоимость единицы из блокчейна' })
  unitCost!: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'supplier_amount', type: 'decimal', precision: 10, scale: 2, comment: 'Сумма поставщика' })
  supplierAmount!: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'membership_fee', type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Членский взнос' })
  membershipFee!: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 2, comment: 'Общая стоимость' })
  totalCost!: number;

  @Column({
    name: 'cancellation_fee',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    // i18n-ignore: комментарий к колонке БД, не текст интерфейса
    comment: 'Штраф за отмену (%)',
  })
  cancellationFee?: number;

  @Column({
    name: 'cancellation_fee_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    // i18n-ignore: комментарий к колонке БД, не текст интерфейса
    comment: 'Сумма штрафа за отмену',
  })
  cancellationFeeAmount?: number;

  // Дополнительные блокчейн количества
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'remain_units', type: 'integer', comment: 'Остаток единиц из блокчейна' })
  remainUnits!: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'blocked_units', type: 'integer', default: 0, comment: 'Заблокированные единицы' })
  blockedUnits!: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'delivered_units', type: 'integer', default: 0, comment: 'Доставленные единицы' })
  deliveredUnits!: number;

  // Временные метки блокчейна
  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt?: Date;

  @Column({ name: 'supplied_at', type: 'timestamp', nullable: true })
  suppliedAt?: Date;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt?: Date;

  @Column({ name: 'received_at', type: 'timestamp', nullable: true })
  receivedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ name: 'declined_at', type: 'timestamp', nullable: true })
  declinedAt?: Date;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ name: 'disputed_at', type: 'timestamp', nullable: true })
  disputedAt?: Date;

  // Гарантийные поля
  @Column({ name: 'warranty_delay_until', type: 'timestamp', nullable: true })
  warrantyDelayUntil?: Date;

  @Column({ name: 'deadline_for_receipt', type: 'timestamp', nullable: true })
  deadlineForReceipt?: Date;

  @Column({ name: 'is_warranty_return', type: 'boolean', default: false })
  isWarrantyReturn!: boolean;

  @Column({ name: 'warranty_return_id', type: 'integer', nullable: true })
  warrantyReturnId?: number;

  // Участники
  @Column({ name: 'product_contributor', type: 'varchar', length: 100, nullable: true })
  productContributor?: string;

  @Column({ name: 'money_contributor', type: 'varchar', length: 100, nullable: true })
  moneyContributor?: string;

  @Column({ name: 'coopname', type: 'varchar', length: 100 })
  @Index('idx_request_coopname')
  coopname!: string;

  @Column({ name: 'username', type: 'varchar', length: 100 })
  @Index('idx_request_username')
  username!: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['offer', 'order'],
    // i18n-ignore: комментарий к колонке БД, не текст интерфейса
    comment: 'Тип заявки: offer - предложение, order - заказ',
  })
  @Index('idx_request_type')
  type!: 'offer' | 'order';

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['draft', 'published', 'moderation', 'active', 'matched', 'completed', 'cancelled', 'declined'],
    default: 'draft',
    // i18n-ignore: комментарий к колонке БД, не текст интерфейса
    comment: 'Статус заявки',
  })
  @Index('idx_request_status')
  status!: string;

  // Основная информация о товаре
  @Column({ name: 'name', type: 'varchar', length: 500 })
  name!: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'article_number', type: 'varchar', length: 50, comment: 'Артикул товара' })
  @Index('idx_request_article_number')
  articleNumber!: string;

  @Column({ name: 'barcode', type: 'varchar', length: 100, nullable: true })
  barcode?: string;

  // Категория и тип
  @Column({ name: 'description_category_id' })
  @Index('idx_request_category')
  descriptionCategoryId!: number;

  @Column({ name: 'type_id' })
  @Index('idx_request_product_type')
  typeId!: number;

  // Цены
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'price', type: 'decimal', precision: 10, scale: 2, comment: 'Цена товара' })
  price!: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'old_price', type: 'decimal', precision: 10, scale: 2, nullable: true, comment: 'Цена до скидки' })
  oldPrice?: number;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'RUB' })
  currencyCode!: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'vat', type: 'varchar', length: 10, comment: 'Ставка НДС' })
  vat!: string;

  // Габариты и вес
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'width', type: 'integer', nullable: true, comment: 'Ширина в мм/см/дюймах' })
  width?: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'height', type: 'integer', nullable: true, comment: 'Высота в мм/см/дюймах' })
  height?: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'depth', type: 'integer', nullable: true, comment: 'Глубина в мм/см/дюймах' })
  depth?: number;

  @Column({ name: 'dimension_unit', type: 'varchar', length: 10, nullable: true, default: 'mm' })
  dimensionUnit?: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'weight', type: 'integer', nullable: true, comment: 'Вес в граммах/кг/фунтах' })
  weight?: number;

  @Column({ name: 'weight_unit', type: 'varchar', length: 10, nullable: true, default: 'g' })
  weightUnit?: string;

  // Количества
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'units', type: 'integer', comment: 'Общее количество единиц' })
  units!: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'available_units', type: 'integer', comment: 'Доступное количество единиц' })
  availableUnits!: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'settled_units', type: 'integer', default: 0, comment: 'Количество проданных единиц' })
  settledUnits!: number;

  // Время жизни и гарантии
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'product_lifecycle_secs', type: 'integer', nullable: true, comment: 'Время жизни продукта в секундах' })
  productLifecycleSecs?: number;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'warranty_days', type: 'integer', nullable: true, comment: 'Гарантийный срок в днях' })
  warrantyDays?: number;

  // Дополнительные данные
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'data', type: 'text', nullable: true, comment: 'Дополнительные данные JSON' })
  data?: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'meta', type: 'text', nullable: true, comment: 'Метаданные JSON' })
  meta?: string;

  // Изображения
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'primary_image_url', type: 'text', nullable: true, comment: 'URL главного изображения' })
  primaryImageUrl?: string;

  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'color_image_url', type: 'text', nullable: true, comment: 'URL образца цвета' })
  colorImageUrl?: string;

  // Геоограничения
  // i18n-ignore: комментарий к колонке БД, не текст интерфейса
  @Column({ name: 'geo_names', type: 'text', nullable: true, comment: 'Геоограничения JSON массив' })
  geoNames?: string;

  // Связи с другими сущностями
  @ManyToOne(() => CategoryEntity, { eager: true })
  @JoinColumn({ name: 'description_category_id' })
  category!: CategoryEntity;

  @ManyToOne(() => TypeEntity, { eager: true })
  @JoinColumn({ name: 'type_id' })
  productType!: TypeEntity;

  @OneToMany(() => RequestAttributeValueEntity, (attr) => attr.request, { cascade: true })
  attributes!: RequestAttributeValueEntity[];

  @OneToMany(() => RequestImageEntity, (image) => image.request, { cascade: true })
  images!: RequestImageEntity[];

  // Временные метки
  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_request_created_at')
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
