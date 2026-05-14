import type { PaymentDomainInterface, PaymentDetailsDomainInterface } from '../interfaces/payment-domain.interface';
import { PaymentStatusEnum } from '../enums/payment-status.enum';
import { PaymentTypeEnum, PaymentDirectionEnum } from '../enums/payment-type.enum';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';
import { IndividualCertificateDTO } from '~/application/common/dto/individual-certificate.dto';
import { EntrepreneurCertificateDTO } from '~/application/common/dto/entrepreneur-certificate.dto';
import { OrganizationCertificateDTO } from '~/application/common/dto/organization-certificate.dto';
import { AccountType } from '~/application/account/enum/account-type.enum';

/**
 * Универсальная доменная сущность платежа
 * Работает как для входящих, так и для исходящих платежей
 */
export class PaymentDomainEntity implements PaymentDomainInterface {
  id?: string;
  coopname: string;
  username: string;
  hash: string;
  quantity: number;
  symbol: string;
  type: PaymentTypeEnum;
  direction: PaymentDirectionEnum;
  status: PaymentStatusEnum;
  provider?: string;
  payment_method_id?: string;
  secret?: string;
  message?: string;
  memo?: string;
  expired_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  created_at: Date;
  updated_at?: Date;
  payment_details?: PaymentDetailsDomainInterface;
  blockchain_data?: any;
  statement?: any;

  // Транзиентный флаг: true — платёж создан вот сейчас в текущем запросе,
  // false — поднят из БД как уже существующий. Нужен вызывающему слою, чтобы
  // отличить «свежесозданный платёж» от «повторно загруженного» и не слать
  // нотификации/события при каждом ре-рендере фронта. Не пишется в БД и не
  // попадает в DTO.
  isNewlyCreated: boolean;

  constructor(data: PaymentDomainInterface, options: { isNewlyCreated?: boolean } = {}) {
    this.id = data.id;
    this.coopname = data.coopname;
    this.username = data.username;
    this.hash = data.hash;
    this.quantity = data.quantity;
    this.symbol = data.symbol;
    this.type = data.type;
    this.direction = data.direction;
    this.status = data.status;
    this.provider = data.provider;
    this.payment_method_id = data.payment_method_id;
    this.secret = data.secret;
    this.message = data.message;
    this.memo = data.memo;
    this.expired_at = data.expired_at;
    this.completed_at = data.completed_at;
    this.failed_at = data.failed_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.payment_details = data.payment_details;
    this.blockchain_data = data.blockchain_data;
    this.statement = data.statement;
    this.isNewlyCreated = options.isNewlyCreated ?? false;
  }

  /**
   * Получить количество и символ в формате строки
   */
  getFormattedAmount(): string {
    return `${this.quantity} ${this.symbol}`;
  }

  /**
   * Проверить, может ли статус быть изменен
   */
  canChangeStatus(): boolean {
    return (
      this.status !== PaymentStatusEnum.COMPLETED &&
      this.status !== PaymentStatusEnum.CANCELLED &&
      this.status !== PaymentStatusEnum.REFUNDED
    );
  }

  /**
   * Получить человекочитаемый статус
   */
  getStatusLabel(): string {
    const statusLabels: Record<PaymentStatusEnum, string> = {
      [PaymentStatusEnum.PENDING]: 'Ожидает обработки',
      [PaymentStatusEnum.PROCESSING]: 'В процессе',
      [PaymentStatusEnum.PAID]: 'Оплачен',
      [PaymentStatusEnum.COMPLETED]: 'Завершен',
      [PaymentStatusEnum.FAILED]: 'Ошибка',
      [PaymentStatusEnum.EXPIRED]: 'Истек',
      [PaymentStatusEnum.CANCELLED]: 'Отменен',
      [PaymentStatusEnum.REFUNDED]: 'Отклонен',
    };
    return statusLabels[this.status] || this.status;
  }

  /**
   * Получить человекочитаемый тип платежа
   */
  getTypeLabel(): string {
    const typeLabels: Record<PaymentTypeEnum, string> = {
      [PaymentTypeEnum.REGISTRATION]: 'Регистрационный взнос',
      [PaymentTypeEnum.DEPOSIT]: 'Паевой взнос',
      [PaymentTypeEnum.WITHDRAWAL]: 'Возврат взноса',
    };
    return typeLabels[this.type] || this.type;
  }

  /**
   * Получить человекочитаемое направление платежа
   */
  getDirectionLabel(): string {
    const directionLabels: Record<PaymentDirectionEnum, string> = {
      [PaymentDirectionEnum.INCOMING]: 'Входящий',
      [PaymentDirectionEnum.OUTGOING]: 'Исходящий',
    };
    return directionLabels[this.direction] || this.direction;
  }

  /**
   * Получить соответствующий хеш для типа платежа
   */
  getSpecificHash(): { [key: string]: string } {
    const hashValue = this.hash || '';
    if (this.direction === PaymentDirectionEnum.OUTGOING) {
      return { outcome_hash: hashValue };
    } else {
      return { income_hash: hashValue };
    }
  }

  /**
   * Преобразовать в DTO для GraphQL (без sensitive данных)
   */
  toDTO(usernameCertificate?: UserCertificateDomainInterface | null): any {
    // Вспомогательная функция для создания сертификата DTO
    const createCertificateDTO = (
      certificate: UserCertificateDomainInterface | null
    ): IndividualCertificateDTO | EntrepreneurCertificateDTO | OrganizationCertificateDTO | null => {
      if (!certificate) return null;

      switch (certificate.type) {
        case AccountType.individual:
          return new IndividualCertificateDTO(certificate);
        case AccountType.entrepreneur:
          return new EntrepreneurCertificateDTO(certificate);
        case AccountType.organization:
          return new OrganizationCertificateDTO(certificate);
        default:
          return null;
      }
    };

    return {
      id: this.id,
      coopname: this.coopname,
      username: this.username,
      username_certificate: createCertificateDTO(usernameCertificate || null),
      hash: this.hash,
      ...this.getSpecificHash(), // Добавляем конкретный хеш
      quantity: this.quantity,
      symbol: this.symbol,
      type: this.type,
      direction: this.direction,
      status: this.status,
      provider: this.provider,
      payment_method_id: this.payment_method_id,
      message: this.message,
      memo: this.memo,
      expired_at: this.expired_at,
      completed_at: this.completed_at,
      failed_at: this.failed_at,
      created_at: this.created_at,
      updated_at: this.updated_at,
      payment_details: this.payment_details,
      blockchain_data: this.blockchain_data,
      statement: this.statement,
      formatted_amount: this.getFormattedAmount(),
      status_label: this.getStatusLabel(),
      type_label: this.getTypeLabel(),
      direction_label: this.getDirectionLabel(),
      can_change_status: this.canChangeStatus(),
      is_final: ![PaymentStatusEnum.PENDING, PaymentStatusEnum.PROCESSING].includes(this.status),
    };
  }
}
