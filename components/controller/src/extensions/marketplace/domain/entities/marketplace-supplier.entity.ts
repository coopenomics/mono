import {
  MarketplaceSupplierModel,
  MarketplaceSupplierStatus,
} from './marketplace-supplier.types';

/**
 * Domain entity записи реестра поставщиков. Конфигурация без on-chain
 * (PG-хранилище расширения). Договор — внешний документ (бумажный по
 * членской модели / электронный ДУХД по боевой); в записи держим только
 * его реквизиты (номер + дата), при необходимости — ссылку на скан/документ.
 */
export class MarketplaceSupplierDomainEntity {
  public readonly id!: string;
  public readonly coopname!: string;
  public readonly member_account!: string;
  public readonly model!: MarketplaceSupplierModel;
  public readonly status!: MarketplaceSupplierStatus;
  public readonly contract_number!: string | null;
  public readonly contract_date!: string | null;
  public readonly contract_document_url!: string | null;
  public readonly requested_by!: string | null;
  public readonly requested_at!: Date;
  public readonly reviewed_by!: string | null;
  public readonly reviewed_at!: Date | null;

  constructor(init: {
    id: string;
    coopname: string;
    member_account: string;
    model: MarketplaceSupplierModel;
    status: MarketplaceSupplierStatus;
    contract_number: string | null;
    contract_date: string | null;
    contract_document_url: string | null;
    requested_by: string | null;
    requested_at: Date;
    reviewed_by: string | null;
    reviewed_at: Date | null;
  }) {
    this.id = init.id;
    this.coopname = init.coopname;
    this.member_account = init.member_account;
    this.model = init.model;
    this.status = init.status;
    this.contract_number = init.contract_number;
    this.contract_date = init.contract_date;
    this.contract_document_url = init.contract_document_url;
    this.requested_by = init.requested_by;
    this.requested_at = init.requested_at;
    this.reviewed_by = init.reviewed_by;
    this.reviewed_at = init.reviewed_at;
  }
}
