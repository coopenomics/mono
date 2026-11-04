import { InnerPayoutRequestStatus } from '@coopenomics/innercoop';
import type { PaymentTypeEnum } from '../enums/payment-type.enum';
import type { PaymentDetailsDomainInterface } from '../interfaces/payment-domain.interface';

/** Состояние заявки на выплату — перечень живёт в контракте `@coopenomics/innercoop`. */
export { InnerPayoutRequestStatus as PayoutRequestStatusEnum };
/**
 * Заявка на выплату до решения совета: всё, из чего решение совета соберёт
 * исходящий платёж кассиру, — сумма, реквизиты на момент подачи, назначение.
 * Хэш заявки становится хэшем платежа.
 */
export interface PayoutRequestDomainInterface {
  id: string;
  /** Хэш заявки в нижнем регистре — им же станет хэш платежа. */
  hash: string;
  coopname: string;
  username: string;
  quantity: number;
  symbol: string;
  type: PaymentTypeEnum;
  provider?: string | null;
  payment_method_id?: string | null;
  memo?: string | null;
  expired_at?: Date | null;
  payment_details?: PaymentDetailsDomainInterface | null;
  blockchain_data?: Record<string, any> | null;
  statement?: Record<string, any> | null;
  related_extension?: string | null;
  related_entity_id?: string | null;
  status: InnerPayoutRequestStatus;
  decided_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type PayoutRequestCreate = Omit<PayoutRequestDomainInterface, 'id' | 'status' | 'decided_at' | 'created_at' | 'updated_at'>;

export interface PayoutRequestRepository {
  create(data: PayoutRequestCreate): Promise<PayoutRequestDomainInterface>;
  /** Поиск по хэшу без учёта регистра: цепь отдаёт хэш заглавными. */
  findByHash(hash: string): Promise<PayoutRequestDomainInterface | null>;
  /** Отметить решение совета; заявка, по которой решение уже есть, не переписывается. */
  markDecided(hash: string, status: InnerPayoutRequestStatus.RELEASED | InnerPayoutRequestStatus.DECLINED): Promise<void>;
  /** Снять заявку, которая так и не дошла до совета (подача в цепь не удалась). */
  deleteAwaiting(hash: string): Promise<void>;
}

export const PAYOUT_REQUEST_REPOSITORY = Symbol('PayoutRequestRepository');
