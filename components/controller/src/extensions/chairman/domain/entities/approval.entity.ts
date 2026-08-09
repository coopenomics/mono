import { ApprovalStatus } from '../enums/approval-status.enum';
import type { IApprovalDatabaseData } from '../interfaces/approval-database.interface';
import type { IApprovalBlockchainData } from '../interfaces/approval-blockchain.interface';
import type { IBlockchainSynchronizable } from '@coopenomics/extension-kit/sync';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';
import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';

/**
 * Доменная сущность одобрения
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные одобрения из таблицы approvals
 */
export class ApprovalDomainEntity extends BaseDomainEntity<IApprovalDatabaseData> implements IBlockchainSynchronizable {
  // Статические ключи для синхронизации
  private static primary_key = 'id'; // Ключ для поиска в блокчейне
  private static sync_key = 'approval_hash'; // Ключ для синхронизации с БД

  // Специфические поля для approval
  public id?: number; // ID в блокчейне

  // Доменные поля (расширения)
  public status!: ApprovalStatus;

  // Поля из блокчейна (approvals.hpp)
  public coopname!: IApprovalBlockchainData['coopname'];
  public username!: IApprovalBlockchainData['username'];
  public document!: ISignedDocumentDomainInterface;
  public approval_hash!: IApprovalBlockchainData['approval_hash'];
  public callback_contract!: IApprovalBlockchainData['callback_contract'];
  public callback_action_approve!: IApprovalBlockchainData['callback_action_approve'];
  public callback_action_decline!: IApprovalBlockchainData['callback_action_decline'];
  public meta!: IApprovalBlockchainData['meta'];
  public created_at!: Date;
  public approved_document?: ISignedDocumentDomainInterface;

  constructor(databaseData: IApprovalDatabaseData, blockchainData?: IApprovalBlockchainData) {
    // Вызываем конструктор базового класса
    super(databaseData, ApprovalStatus.PENDING);

    // Специфичные поля для approval
    this.approval_hash = databaseData.approval_hash?.toLowerCase() || '';

    // Данные из блокчейна
    if (blockchainData) {
      if (this.approval_hash != blockchainData.approval_hash.toLowerCase()) throw new Error('Approval hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.document = blockchainData.document;
      this.approval_hash = blockchainData.approval_hash.toLowerCase();
      this.callback_contract = blockchainData.callback_contract;
      this.callback_action_approve = blockchainData.callback_action_approve;
      this.callback_action_decline = blockchainData.callback_action_decline;
      this.meta = blockchainData.meta;
      this.created_at = new Date(blockchainData.created_at);

      // Статус остается как есть (не меняется из блокчейна)
    }
  }
  getBlockNum(): number | undefined {
    return this.block_num;
  }

  // Статические методы для получения ключей
  public static getPrimaryKey(): string {
    return ApprovalDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return ApprovalDomainEntity.sync_key;
  }

  // Реализация IBlockchainSynchronizable
  getPrimaryKey(): string {
    return this.id?.toString() || '';
  }

  getSyncKey(): string {
    return this.approval_hash;
  }

  updateFromBlockchain(blockchainData: IApprovalBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.updateBase({
      block_num: blockNum,
      present: present,
    });

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.created_at = new Date(blockchainData.created_at);

    // Статус не обновляется из блокчейна (он меняется только через мутации)

    // Нормализация hash полей
    if (this.approval_hash) this.approval_hash = this.approval_hash.toLowerCase();
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из approvals.hpp
   */
  private mapStatusToDomain(blockchainStatus: string): ApprovalStatus {
    switch (blockchainStatus) {
      case 'pending':
        return ApprovalStatus.PENDING;
      case 'approved':
        return ApprovalStatus.APPROVED;
      case 'declined':
        return ApprovalStatus.DECLINED;
      default:
        // По умолчанию считаем статус pending
        return ApprovalStatus.PENDING;
    }
  }

  // Методы для изменения статуса через мутации
  approve(approved_document?: ISignedDocumentDomainInterface): void {
    this.status = ApprovalStatus.APPROVED;
    if (approved_document) {
      this.approved_document = approved_document;
    }
  }

  decline(): void {
    this.status = ApprovalStatus.DECLINED;
  }
}
