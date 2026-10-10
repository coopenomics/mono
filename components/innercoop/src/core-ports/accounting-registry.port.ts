/**
 * Реестры бухгалтерии и процессов для приложения, которое показывает их на
 * своём столе.
 *
 * Счета, кошельки, операции, проводки и процессы ведёт ядро. Приложение
 * (Стол бухгалтера) отдаёт их собственными операциями и проверяет доступ по
 * своей таблице прав — ядро роли приложения не знает и прав ей не даёт.
 *
 * Порт **не проверяет права**: вправе ли пайщик читать реестр, решает
 * операция приложения до вызова порта. Строки приходят в том виде, в каком
 * их отдают операции ядра; поля описаны типами реестров каркаса расширений.
 */

/** Строка реестра или страница строк в том виде, в каком её отдаёт ядро. */
export type InnerRegistryRecord = Record<string, any>;

export interface IAccountingRegistryPort {
  /** Счета плана счетов с остатками. */
  ledgerAccounts(coopname: string): Promise<InnerRegistryRecord[]>;
  /** Кошельки кооператива с остатками. */
  ledgerWallets(coopname: string): Promise<InnerRegistryRecord[]>;
  /** Страница реестра операций по отбору. */
  ledgerHistory(input: InnerRegistryRecord): Promise<InnerRegistryRecord>;
  /** Страница реестра проводок по отбору. */
  ledgerPostings(input: InnerRegistryRecord): Promise<InnerRegistryRecord>;
  /** Процесс целиком: действия, изменения состояния, документы. */
  process(hash: string, coopname: string): Promise<InnerRegistryRecord>;
  /** Страница реестра процессов по отбору. */
  processes(filter: InnerRegistryRecord, pagination: InnerRegistryRecord): Promise<InnerRegistryRecord>;
}

export const ACCOUNTING_REGISTRY_PORT = Symbol.for('Innercoop.CorePort.AccountingRegistry');
