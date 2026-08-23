import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PaymentStatusEnum } from '~/domain/gateway/enums/payment-status.enum';
import { PaymentTypeEnum, PaymentDirectionEnum } from '~/domain/gateway/enums/payment-type.enum';
import type {
  PaymentDomainInterface,
  PaymentDetailsDomainInterface,
} from '~/domain/gateway/interfaces/payment-domain.interface';
import type { ISignedDocument } from '@coopenomics/innercoop';

/**
 * Унифицированная сущность платежа для TypeORM
 * Поддерживает все типы платежей (входящие и исходящие)
 */
@Entity('payments')
export class PaymentEntity implements PaymentDomainInterface {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  hash!: string;

  @Column()
  coopname!: string;

  @Column()
  username!: string;

  @Column()
  quantity!: number;

  @Column()
  symbol!: string;

  @Column({
    type: 'enum',
    enum: PaymentTypeEnum,
  })
  type!: PaymentTypeEnum;

  @Column({
    type: 'enum',
    enum: PaymentDirectionEnum,
  })
  direction!: PaymentDirectionEnum;

  @Column({
    type: 'enum',
    enum: PaymentStatusEnum,
    default: PaymentStatusEnum.PENDING,
  })
  status!: PaymentStatusEnum;

  @Column({ nullable: true })
  provider?: string;

  @Column({ nullable: true })
  payment_method_id?: string;

  @Column({ nullable: true })
  secret?: string;

  @Column({ nullable: true, type: 'text' })
  message?: string;

  @Column({ nullable: true, type: 'text' })
  memo?: string;

  @Column({ nullable: true, type: 'timestamp' })
  expired_at?: Date;

  @Column({ nullable: true, type: 'timestamp' })
  completed_at?: Date;

  @Column({ nullable: true, type: 'timestamp' })
  failed_at?: Date;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ nullable: true, type: 'timestamp' })
  updated_at?: Date;

  @Column('json', { nullable: true })
  payment_details?: PaymentDetailsDomainInterface;

  @Column('json', { nullable: true })
  blockchain_data?: any;

  @Column('json', { nullable: true })
  statement?: ISignedDocument;

  /**
   * Связь с extension, инициировавшим платёж. Заполняется для системных
   * outgoing_payment'ов (например, marketplace выплачивает поставщику без
   * пользовательского `statement`). Для обычных пайщик-инициированных
   * платежей оба поля остаются NULL — кассирский стол отображает их в
   * общей ленте без extension-маркера. Story 598-17 / AR35.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  related_extension?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  related_entity_id?: string | null;
}
