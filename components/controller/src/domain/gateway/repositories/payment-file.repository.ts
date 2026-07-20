import type { IPaymentFileDatabaseData } from '../interfaces/payment-file-database.interface';

/**
 * Реестр файлов, приложенных к платежам (чеки об оплате). Файл — чистая БД-сущность
 * (MinIO + метаданные), блокчейна за ним нет, поэтому интерфейс не наследует
 * sync-репозиторий.
 */
export interface PaymentFileRepository {
  create(data: IPaymentFileDatabaseData): Promise<IPaymentFileDatabaseData>;
  findById(id: number): Promise<IPaymentFileDatabaseData | null>;
  findByChecksum(coopname: string, checksum: string): Promise<IPaymentFileDatabaseData | null>;
  findByPayment(coopname: string, paymentHash: string): Promise<IPaymentFileDatabaseData[]>;
  delete(id: number): Promise<void>;
}

export const PAYMENT_FILE_REPOSITORY = Symbol('PaymentFileRepository');
