/**
 * Реестр кошельков ledger2 — source of truth в контракте:
 * `components/contracts/cpp/lib/core/ledger2/wallets.hpp`
 * (`LEDGER2_WALLET_REGISTRY`). При добавлении/переименовании кошелька
 * синхронизировать обе стороны.
 *
 * Идентификатор кошелька — `eosio::name` с префиксом `w.<contract>.<waltype>`
 * по аналогии с операциями (`o.<contract>.<verb>`) и процессами
 * (`p.<contract>.<noun>`). Длина ≤ 13 base32-символов.
 *
 * `human_name` — отображаемое имя в UI (standards-site, desktop).
 */
import type { IName } from '../interfaces/ledger2'

export interface WalletMeta {
  /** Машинный идентификатор — eosio::name в контракте. */
  name: IName
  /** Человекочитаемое название для UI. */
  human_name: string
}

export const LEDGER2_WALLET_REGISTRY: readonly WalletMeta[] = [
  // Группа паевого фонда (Cr 80)
  { name: 'w.wal.share',  human_name: 'ЦПП «Цифровой Кошелёк» — паевые взносы деньгами' },
  { name: 'w.reg.minshr', human_name: 'Минимальный паевой взнос' },
  { name: 'w.wal.sharid', human_name: 'Паевой фонд — принятые РИД' },

  // Целевое финансирование (Cr 86)
  { name: 'w.reg.entry',  human_name: 'Вступительные взносы' },
  { name: 'w.sov.member', human_name: 'Членские взносы (платформенные)' },
  { name: 'w.sov.delgte', human_name: 'Делегатские членские взносы' },

  // Выплаты / обязательства / финансовые вложения
  { name: 'w.wal.wthdrw', human_name: 'Возвраты паевых взносов пайщикам' },
  { name: 'w.mkt.payout', human_name: 'Выплаты поставщикам' },
  { name: 'w.cap.loan',   human_name: 'Выданные пайщикам беспроцентные займы' },

  // Служебные
  { name: 'w.led.adjust', human_name: 'Ручные корректировки' },

  // ЦПП «Благорост»
  { name: 'w.cap.bginv',  human_name: 'ЦПП «Благорост» — инвестиции деньгами' },
  { name: 'w.cap.bgrid',  human_name: 'ЦПП «Благорост» — принятые РИД' },
  { name: 'w.cap.bgprop', human_name: 'ЦПП «Благорост» — имущественные паевые взносы' },
  { name: 'w.cap.bgmem',  human_name: 'ЦПП «Благорост» — членские взносы' },

  // ЦПП «Генератор»
  { name: 'w.cap.gncom',  human_name: 'ЦПП «Генератор» — принятый коммит (имущество)' },
  { name: 'w.cap.gnmem',  human_name: 'ЦПП «Генератор» — членские взносы' },

  // ЦПП «Стол Заказов»
  { name: 'w.mkt.fund',   human_name: 'ЦПП «Стол Заказов» — общий кошелёк' },
] as const

const walletHumanByName = new Map<string, string>(
  LEDGER2_WALLET_REGISTRY.map((w) => [w.name, w.human_name]),
)

/**
 * Возвращает человекочитаемое имя кошелька по его eosio::name-идентификатору.
 * Возвращает undefined для незарегистрированных имён и для пустого имени
 * (sentinel "" — кошелёк-источник/сток вне системы при ISSUE/REVOKE).
 */
export function getWalletHumanName(name: IName | null | undefined): string | undefined {
  if (!name) return undefined
  return walletHumanByName.get(name)
}
