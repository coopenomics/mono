// domain/payments/interfaces/payment-method-data.interface.ts
export interface SBPDataDomainInterface {
  phone: string;
  /** Банк получателя. У реквизитов, сохранённых до появления поля, отсутствует. */
  bank_name?: string;
}

export interface BankTransferDataDomainInterface {
  account_number: string;
  bank_name: string;
  card_number?: string;
  currency: string;
  details: {
    bik: string;
    corr: string;
  };
}
