import type { BranchDomainInterface } from '../interfaces/branch-domain.interface';
import type { BranchContract } from 'cooptypes';
import type { OrganizationDomainInterface } from '~/domain/common/interfaces/organization-domain.interface';
import type { IndividualDomainInterface } from '~/domain/common/interfaces/individual-domain.interface';
import type { BankPaymentMethodDomainInterface } from '~/domain/payment-method/interfaces/bank-payment-method-domain.interface';

export class BranchDomainEntity implements BranchDomainInterface {
  public readonly coopname: string;
  public readonly braname: string;
  public readonly trustee: IndividualDomainInterface;
  public readonly trusted: IndividualDomainInterface[];

  public readonly type: string;
  public readonly short_name: string;
  public readonly full_name: string;
  public readonly represented_by: {
    first_name: string;
    last_name: string;
    middle_name: string;
    position: string;
    based_on: string;
  };
  public readonly country: string;
  public readonly city: string;
  public readonly full_address: string;
  public readonly fact_address: string;
  public readonly phone: string;
  public readonly email: string;

  public readonly bank_account: BankPaymentMethodDomainInterface;
  public readonly details: {
    inn: string;
    ogrn: string;
    kpp: string;
  };
  public readonly participants_count: number;

  constructor(
    coopname: string,
    branchBlockchainData: BranchContract.Tables.Branches.IBranch,
    organizationDatabaseData: OrganizationDomainInterface,
    trusteeData: IndividualDomainInterface,
    trustedData: IndividualDomainInterface[],
    bankAccount: BankPaymentMethodDomainInterface,
    participantsCount = 0
  ) {
    if (branchBlockchainData.braname != organizationDatabaseData.username)
      throw new Error(`Неверные данные для агрегата: username и braname кооперативного участка должны совпадать`);

    this.coopname = coopname;

    this.braname = branchBlockchainData.braname;
    this.trustee = trusteeData;
    this.trusted = trustedData;
    this.bank_account = bankAccount;

    this.type = organizationDatabaseData.type;
    this.short_name = organizationDatabaseData.short_name;
    this.full_name = organizationDatabaseData.full_name;
    this.represented_by = organizationDatabaseData.represented_by;
    this.country = organizationDatabaseData.country;
    this.city = organizationDatabaseData.city;
    this.full_address = organizationDatabaseData.full_address;
    this.fact_address = organizationDatabaseData.fact_address;
    this.phone = organizationDatabaseData.phone;
    this.email = organizationDatabaseData.email;
    this.details = organizationDatabaseData.details;
    this.participants_count = participantsCount;
  }
}
