import type { Mutations, Zeus } from '@coopenomics/sdk';
import { SovietContract, GatewayContract, Cooperative } from 'cooptypes';

/**
 * Соглашение пайщика как его отдаёт `getAgreements` (Эпик 2): объединение
 * `soviet::agreements3` (непрограммные) и `wallet::users.programs[]`
 * (программные). Источник `IAgreement` из cooptypes больше не используется.
 */
export type IUserAgreement = Zeus.ModelTypes['Agreement'];

export type ICreateDeposit =
  Mutations.Wallet.CreateDepositPayment.IInput['data'];
export type ICreateInitialPayment =
  Mutations.Participants.CreateInitialPayment.IInput['data'];

export type IProgramWalletData =
  SovietContract.Tables.ProgramWallets.IProgramWallet;

/**
 * Минимальная сводка программы кооператива, нужная UI: id + читаемое title
 * (из cooptypes/programs.ts) + тип программы. Полная chain-запись больше
 * не таскается на фронт — backend `cooperativePrograms` отдаёт только то,
 * что отображается. Поле `title` — UI-метка из реестра, а не chain-title.
 */
export interface ICoopProgramSummary {
  id: number | string;
  title: string;
  program_type: string;
  is_active?: boolean;
  draft_id?: number;
}

export type ExtendedProgramWalletData = IProgramWalletData & {
  program_type: string;
  program_details: ICoopProgramSummary;
};

export type IDepositData = GatewayContract.Tables.Incomes.IIncome;
export type IWithdrawData = GatewayContract.Tables.Outcomes.IOutcome;

export interface ILoadSingleUserWallet {
  coopname: string;
  username: string;
}

export interface ILoadSingleUserDeposit {
  coopname: string;
  username: string;
  deposit_id: string | number;
}

export interface ILoadSingleUserWithdraw {
  coopname: string;
  username: string;
  withdraw_id: string | number;
}

export interface ILoadUserDeposits {
  coopname: string;
  username: string;
}

export interface ILoadUserWithdraws {
  coopname: string;
  username: string;
}

export interface ILoadUserProgramWallets {
  coopname: string;
  username: string;
}

export interface ILoadUserWallet {
  coopname: string;
  username: string;
}

export interface ICreateWithdraw {
  quantity: string;
}

export type IPaymentMethodData = Cooperative.Payments.IPaymentData;
export type IGetResponsePaymentMethodData =
  Cooperative.Document.IGetResponse<IPaymentMethodData>;

export type IBankTransferData = Cooperative.Payments.IBankAccount;
export type ISBPData = Cooperative.Payments.ISbpDetails;

export interface IGetPaymentMethods {
  username?: string;
}

export interface IDeletePaymentMethod {
  username: string;
  method_id: number;
}
