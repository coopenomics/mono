export interface BankAccountDomainInterface {
  currency: string;
  card_number?: string;
  bank_name: string;
  account_number: string;
  details: {
    bik: string;
    corr: string;
  };
}
