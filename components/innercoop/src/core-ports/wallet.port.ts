import type { ProgramType } from './program.contract';

/**
 * Кошельки пайщика.
 *
 * Расширение показывает пайщику его средства и проверяет, хватает ли их на
 * задуманное, но самими средствами не распоряжается: движение денег проводит
 * ядро. Раньше расширения инжектили `WALLET_DOMAIN_PORT` и
 * `USER_WALLET_REPOSITORY` по пути `~/domain/wallet`, которого за пределами
 * монолита нет.
 *
 * Порты **не скоупят доступ**: чужой кошелёк — чувствительные данные, право
 * его смотреть проверяет вызывающий до обращения сюда.
 *
 * Суммы — строки с символом токена, ровно как в цепи: разбирать их числом
 * нельзя, точность зависит от токена.
 */

/** Кошелёк пайщика в целевой программе. */
export interface InnerProgramWallet {
  id?: string;
  coopname?: string;
  program_id?: string;
  program_type?: ProgramType;
  /** Соглашение, по которому пайщик участвует в программе. */
  agreement_id?: string;
  username?: string;
  /** Доступно к распоряжению. */
  available?: string;
  /** Заблокировано под незакрытые обязательства. */
  blocked?: string;
  /** Членские взносы, внесённые в программу. */
  membership_contribution?: string;
}

export interface InnerProgramWalletFilter {
  coopname?: string;
  username?: string;
  program_id?: string;
}

/**
 * Доля пайщика в общем кошельке кооператива — то, что причитается лично ему из
 * средств, которыми кооператив распоряжается сообща.
 */
export interface InnerUserWallet {
  id?: string;
  coopname?: string;
  /** Имя общего кошелька, в котором учтена доля. */
  wallet_name?: string;
  username?: string;
  available?: string;
  blocked?: string;
}

export interface IProgramWalletPort {
  /** Кошелёк по отбору; `null`, если пайщик в программе не участвует. */
  getProgramWallet(filter: InnerProgramWalletFilter): Promise<InnerProgramWallet | null>;

  getProgramWallets(filter: InnerProgramWalletFilter): Promise<InnerProgramWallet[]>;
}

export interface IUserWalletPort {
  /** Доля пайщика в конкретном общем кошельке; `null`, если её нет. */
  findByWalletAndUsername(coopname: string, walletName: string, username: string): Promise<InnerUserWallet | null>;

  /** Все доли пайщика в общих кошельках кооператива. */
  findByUsername(coopname: string, username: string): Promise<InnerUserWallet[]>;

  /** Все доли в конкретном кошельке — для отчётов и председателя. */
  findByWallet(coopname: string, walletName: string): Promise<InnerUserWallet[]>;
}

export const PROGRAM_WALLET_PORT = Symbol.for('Innercoop.CorePort.ProgramWallet');
export const USER_WALLET_PORT = Symbol.for('Innercoop.CorePort.UserWallet');
