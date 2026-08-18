/**
 * Ресурсы аккаунта в цепи: оперативная память, полоса, процессорное время.
 *
 * Цепь берёт плату ресурсами за каждое действие, и без них аккаунт перестаёт
 * работать. Пополняет их кооператив, а расширение только видит текущее
 * состояние и просит пополнить — саму оплату проводит ядро своим ключом.
 */

/** Состояние аккаунта в цепи; состав зависит от версии узла. */
export interface InnerChainAccountResources {
  [key: string]: any;
}

export interface IChainResourcesPort {
  /** Состояние аккаунта; `null`, если аккаунта в цепи нет. */
  getAccount(username: string): Promise<InnerChainAccountResources | null>;

  /** Пополнить ресурсы аккаунта на указанную сумму. */
  powerUp(username: string, quantity: string): Promise<void>;
}

export const CHAIN_RESOURCES_PORT = Symbol.for('Innercoop.CorePort.ChainResources');
