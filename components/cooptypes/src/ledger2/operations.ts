/**
 * Реестр именованных операций ledger2 — source of truth в контракте:
 * `components/contracts/cpp/lib/core/ledger2/operations.hpp` (`OPERATION_REGISTRY`).
 *
 * При добавлении/переименовании операции синхронизировать обе стороны + при
 * необходимости `cpp/lib/core/ledger2/{wallets.hpp,accounts.hpp}`.
 *
 * Нейминг: `o.<contract>.<verb>`, где префикс `o.` — operation, далее имя
 * контракта-источника (reg/wal/cap/mkt/sov/mig), затем короткий глагол.
 * Длина eosio::name ≤ 12 символов (13-й символ имеет ограничение по алфавиту).
 *
 * Идентификаторы кошельков (`wallet_from`/`wallet_to`) — eosio::name с
 * префиксом `w.<contract>.<waltype>` (см. `./wallets.ts`). Пустая строка
 * (`""`) — sentinel «кошелёк вне системы» для ISSUE и BURN.
 */
import type { IName } from '../interfaces/ledger2'

export type WalletOp = 'ISSUE' | 'TRANSFER' | 'BURN' | 'NONE'

export interface OperationMeta {
  /** Машинный идентификатор — eosio::name в контракте. */
  code: string
  /** Контрактный `process_type`, связанный с этой операцией. */
  process_type: string
  /** Контракт-источник. */
  contract: string
  /** Имя C++-константы в namespace operations::<contract>::. */
  name: string
  /**
   * Тип операции по кошельку. Для `kind: 'adjustment'` — null, потому что
   * реальный wallet_op зависит от исходной операции (WALMOVE = TRANSFER без Dr/Cr,
   * REVERSAL = TRANSFER/BURN в зависимости от зеркала).
   */
  wallet_op: WalletOp | null
  /** Кошелёк-источник (null для ISSUE и для adjustment-операций). */
  wallet_from: IName | null
  /** Кошелёк-приёмник (null для BURN и для adjustment-операций). */
  wallet_to: IName | null
  /** Код счёта Дт (null без бухпроводки, ADR-003: ⇔ credit == null). */
  debit: number | null
  /** Код счёта Кт (null без бухпроводки, ADR-003: ⇔ debit == null). */
  credit: number | null
  /** Человекочитаемое название для UI. */
  human_name: string
  /**
   * Тип операции:
   *   - `'standard'` (default) — параметры зашиты в контрактном OPERATION_REGISTRY,
   *     вызывается через `ledger2::apply`.
   *   - `'adjustment'` — параметры задаются динамически каждый вызов; не входит
   *     в контрактный OPERATION_REGISTRY; вызывается отдельным action
   *     (`ledger2::walmove` для WALMOVE, `ledger2::revert` для REVERSAL).
   *     UI запрещает таким операциям обычные пути и подсвечивает фильтром
   *     «Только корректировки».
   */
  kind?: 'standard' | 'adjustment'
}

export const LEDGER2_OPERATION_REGISTRY: readonly OperationMeta[] = [
  // registrator
  { code: 'o.reg.payent', process_type: 'p.reg.accept', contract: 'registrator', name: 'PAY_ENTRANCE', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.reg.entry', debit: 51, credit: 86, human_name: 'Вступительный взнос пайщика' },

  { code: 'o.reg.putmin', process_type: 'p.reg.accept', contract: 'registrator', name: 'PUT_MINSHARE', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.reg.minshr', debit: 51, credit: 80, human_name: 'Минимальный паевой взнос пайщика при регистрации' },

  // Двухфазный путь через совет (reguser → confirmpay → confirmreg/declinereg)
  { code: 'o.reg.inpay', process_type: 'p.reg.accept', contract: 'registrator', name: 'RECEIVE_PAYMENT', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.reg.pend', debit: 51, credit: 76, human_name: 'Приём регистрационного взноса в ожидание решения совета' },

  { code: 'o.reg.setmin', process_type: 'p.reg.accept', contract: 'registrator', name: 'SETTLE_MINSHARE', wallet_op: 'TRANSFER', wallet_from: 'w.reg.pend', wallet_to: 'w.reg.minshr', debit: 76, credit: 80, human_name: 'Зачисление минимального паевого взноса по решению совета' },

  { code: 'o.reg.setent', process_type: 'p.reg.accept', contract: 'registrator', name: 'SETTLE_ENTRANCE', wallet_op: 'TRANSFER', wallet_from: 'w.reg.pend', wallet_to: 'w.reg.entry', debit: 76, credit: 86, human_name: 'Зачисление вступительного взноса по решению совета' },

  { code: 'o.reg.refund', process_type: 'p.reg.refund', contract: 'registrator', name: 'REFUND', wallet_op: 'BURN', wallet_from: 'w.reg.pend', wallet_to: null, debit: 76, credit: 51, human_name: 'Возврат регистрационного взноса при отказе совета' },

  { code: 'o.reg.mvmin', process_type: 'p.wal.wthdrw', contract: 'registrator', name: 'MOVE_MINSHARE', wallet_op: 'TRANSFER', wallet_from: 'w.reg.minshr', wallet_to: 'w.wal.share', debit: null, credit: null, human_name: 'Перенос минимального паевого на главный при выходе из кооператива' },

  // wallet
  { code: 'o.wal.depcpl', process_type: 'p.wal.depo', contract: 'wallet', name: 'COMPLETE_DEPOSIT', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.wal.share', debit: 51, credit: 80, human_name: 'Внесение пайщиком паевого взноса' },

  { code: 'o.wal.wthreq', process_type: 'p.wal.wthdrw', contract: 'wallet', name: 'REQUEST_WITHDRAW', wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.wal.wpend', debit: null, credit: null, human_name: 'Резервирование паевого под запрос на возврат' },

  { code: 'o.wal.wthdec', process_type: 'p.wal.wthdrw', contract: 'wallet', name: 'DECLINE_WITHDRAW', wallet_op: 'TRANSFER', wallet_from: 'w.wal.wpend', wallet_to: 'w.wal.share', debit: null, credit: null, human_name: 'Снятие резерва паевого после отклонения запроса на возврат' },

  { code: 'o.wal.wthcpl', process_type: 'p.wal.wthdrw', contract: 'wallet', name: 'COMPLETE_WITHDRAW', wallet_op: 'BURN', wallet_from: 'w.wal.wpend', wallet_to: null, debit: 80, credit: 51, human_name: 'Возврат паевого взноса пайщику' },

  // capital (ADR-009: единые программные кошельки `w.cap.blago`/`w.cap.gen`)
  // IMPORT и ACCEPT_PROPERTY — Dr 04 (НМА), не Dr 51: импорт/акт-2 фиксируют
  // имущественный вклад как РИД, не деньги. Денежные взносы в Благорост — INVEST.
  { code: 'o.cap.import', process_type: 'p.cap.import', contract: 'capital', name: 'IMPORT', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.cap.blago', debit: 4, credit: 80, human_name: 'Паевой взнос по ЦПП «Благорост» (офлайн-импорт)' },

  { code: 'o.cap.invest', process_type: 'p.cap.invest', contract: 'capital', name: 'INVEST', wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.cap.blago', debit: null, credit: null, human_name: 'Инвестиция в ЦПП «Благорост»' },

  { code: 'o.cap.commit', process_type: 'p.cap.rid', contract: 'capital', name: 'COMMIT_RID', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.cap.gen', debit: 8, credit: 80, human_name: 'Коммит РИД по программе «Генератор»' },

  { code: 'o.cap.accept', process_type: 'p.cap.rid', contract: 'capital', name: 'ACCEPT_RID', wallet_op: 'NONE', wallet_from: null, wallet_to: null, debit: 4, credit: 8, human_name: 'Приём РИД в паевой фонд' },

  { code: 'o.cap.actprp', process_type: 'p.cap.prop', contract: 'capital', name: 'ACCEPT_PROPERTY', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.cap.blago', debit: 4, credit: 80, human_name: 'Паевой взнос (имущественный) по программе «Благорост»' },

  { code: 'o.cap.preimp', process_type: 'p.cap.preimp', contract: 'capital', name: 'PREIMP', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.cap.preimp', debit: 4, credit: 80, human_name: 'Первичный учёт РИД-взноса до перехода на электронный учёт' },

  { code: 'o.cap.drppre', process_type: 'p.cap.import', contract: 'capital', name: 'DROP_PREIMP', wallet_op: 'BURN', wallet_from: 'w.cap.preimp', wallet_to: null, debit: 80, credit: 4, human_name: 'Закрытие пред-импорт-учёта РИД-взноса при переходе на электронный учёт' },

  { code: 'o.cap.lend', process_type: 'p.cap.debt', contract: 'capital', name: 'LEND', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.cap.loan', debit: 58, credit: 51, human_name: 'Выдача пайщику беспроцентного займа' },

  { code: 'o.cap.repay', process_type: 'p.cap.rid', contract: 'capital', name: 'REPAY', wallet_op: 'TRANSFER', wallet_from: 'w.cap.loan', wallet_to: 'w.wal.share', debit: 80, credit: 58, human_name: 'Возврат беспроцентного займа пайщика по акту-2' },

  { code: 'o.cap.wthcap', process_type: 'p.cap.wthcap', contract: 'capital', name: 'WITHDRAW_FROM_CAPITAL', wallet_op: 'TRANSFER', wallet_from: 'w.cap.blago', wallet_to: 'w.wal.share', debit: null, credit: null, human_name: 'Возврат паевого из ЦПП «Благорост» в Цифровой Кошелёк' },

  { code: 'o.cap.cnvshr', process_type: 'p.cap.rid', contract: 'capital', name: 'CONVERT_TO_SHARE', wallet_op: 'TRANSFER', wallet_from: 'w.cap.gen', wallet_to: 'w.wal.share', debit: null, credit: null, human_name: 'Конвертация сегмента: РИД → главный кошелёк' },

  { code: 'o.cap.cnvbl', process_type: 'p.cap.rid', contract: 'capital', name: 'CONVERT_TO_BLAGO', wallet_op: 'TRANSFER', wallet_from: 'w.cap.gen', wallet_to: 'w.cap.blago', debit: null, credit: null, human_name: 'Конвертация сегмента: РИД → ЦПП «Благорост»' },

  { code: 'o.cap.pgtop', process_type: 'p.cap.pgexp',   contract: 'capital',
    name: 'PROGRAM_EXPENSE_TOPUP', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.cap.pgexp',
    debit: null, credit: null,
    human_name: 'Пополнение пула программных расходов ЦПП «Благорост»' },

  // expense — шасси расходов (оплата СЗ из кооперативного пула расходов)
  { code: 'o.exp.blgadv',  process_type: 'p.exp.expns', contract: 'expense',
    name: 'BLAGO_ADVANCE', wallet_op: 'TRANSFER', wallet_from: 'w.cap.pgexp', wallet_to: 'w.exp.adv',
    debit: 8, credit: 51,
    human_name: 'Выдача подотчётных из пула расходов ЦПП «Благорост»' },

  { code: 'o.exp.blgdir',  process_type: 'p.exp.expns', contract: 'expense',
    name: 'BLAGO_DIRECT', wallet_op: 'BURN', wallet_from: 'w.cap.pgexp', wallet_to: null,
    debit: 8, credit: 51,
    human_name: 'Прямая оплата из пула расходов ЦПП «Благорост»' },

  { code: 'o.exp.advrpt',  process_type: 'p.exp.expns', contract: 'expense',
    name: 'ADVANCE_REPORT', wallet_op: 'BURN', wallet_from: 'w.exp.adv', wallet_to: null,
    debit: null, credit: null,
    human_name: 'Закрытие подотчёта пайщика по отчёту' },

  { code: 'o.exp.advret',  process_type: 'p.exp.expns', contract: 'expense',
    name: 'ADVANCE_RETURN', wallet_op: 'TRANSFER', wallet_from: 'w.exp.adv', wallet_to: 'w.cap.pgexp',
    debit: 51, credit: 8,
    human_name: 'Возврат неиспользованного подотчёта в пул расходов' },

  { code: 'o.exp.over',    process_type: 'p.exp.expns', contract: 'expense',
    name: 'OVERSPEND', wallet_op: 'TRANSFER', wallet_from: 'w.cap.pgexp', wallet_to: 'w.exp.adv',
    debit: 8, credit: 51,
    human_name: 'Доплата сверх подотчёта (перерасход)' },

  // marketplace — членская модель «Стола заказов» (синхронно с
  // operations.hpp `OPERATION_REGISTRY`, namespace operations::marketplace).
  // Legacy клиринговые o.mkt.supply/o.mkt.recv (p.mkt.reqst) удалены —
  // membership-модель их не использует.
  { code: 'o.mkt.lock',    process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'LOCK_ORDER',     wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.mkt.order',
    debit: 80, credit: 86,
    human_name: 'Резервирование под заказ' },

  // Доплата по факту (signiss2, actual > ordered): паевой сперва конвертируется
  // в членский «Стола заказов» (o.mkt.conv), затем им добирается резерв
  // (o.mkt.lockm). Списание идёт ИМЕННО с членского, не напрямую с паевого.
  { code: 'o.mkt.conv',    process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'CONVERT_TO_MKT_MEMBER', wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.mkt.member',
    debit: 80, credit: 86,
    human_name: 'Конвертация паевого в членский «Стола заказов» под доплату' },

  { code: 'o.mkt.lockm',   process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'LOCK_FROM_MEMBER', wallet_op: 'TRANSFER', wallet_from: 'w.mkt.member', wallet_to: 'w.mkt.order',
    debit: null, credit: null,
    human_name: 'Добор резерва заказа с членского «Стола заказов»' },

  // Снятие резерва (отмена / недовыдача / actual < ordered): средства уходят
  // на членский «Стола заказов» (не на универсальный членский) — остаются в программе.
  { code: 'o.mkt.unlock',  process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'UNLOCK_ORDER',   wallet_op: 'TRANSFER', wallet_from: 'w.mkt.order', wallet_to: 'w.mkt.member',
    debit: null, credit: null,
    human_name: 'Снятие резерва при отмене заказа' },

  // Удержание 50% при отказе пайщика от получения после акцепта поставщиком:
  // удержанная половина тела заказа транзитом через пул членских взносов уходит
  // в общий кошелёк КУ (тем же o.brn.common). Прямой перевод на w.brn.common
  // невозможен — walletop держит один username на обе стороны.
  { code: 'o.mkt.penal',   process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'REFUSAL_PENALTY', wallet_op: 'TRANSFER', wallet_from: 'w.mkt.order', wallet_to: 'w.mkt.fee',
    debit: null, credit: null,
    human_name: 'Удержание при отказе пайщика от получения после акцепта поставщиком' },

  { code: 'o.mkt.purch',   process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'PURCHASE_FROM_SUPPLIER', wallet_op: 'NONE', wallet_from: null, wallet_to: null,
    debit: 10, credit: 86,
    human_name: 'Приёмка имущества кооперативом по АПП приёмки' },

  { code: 'o.mkt.payout',  process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'PAY_SUPPLIER',   wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.mkt.payout',
    debit: 86, credit: 51,
    human_name: 'Оплата поставщику с расчётного счёта по факту приёмки' },

  { code: 'o.mkt.consum',  process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'CONSUME_BY_MEMBER', wallet_op: 'BURN', wallet_from: 'w.mkt.order', wallet_to: null,
    debit: 86, credit: 10,
    human_name: 'Выдача имущества пайщику по АПП выдачи' },

  // Гарантийный возврат — compensating forward к o.mkt.consum: восстановление
  // средств на членском «Стола заказов» заказчика и возврат имущества на склад.
  { code: 'o.mkt.return',  process_type: 'p.mkt.return',  contract: 'marketplace',
    name: 'RETURN_BY_MEMBER', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.mkt.member',
    debit: 10, credit: 86,
    human_name: 'Гарантийный возврат — восстановление средств и имущества' },

  { code: 'o.mkt.wroff',   process_type: 'p.mkt.wroff',   contract: 'marketplace',
    name: 'WRITE_OFF_PERISHABLE', wallet_op: 'NONE', wallet_from: null, wallet_to: null,
    debit: 86, credit: 10,
    human_name: 'Утилизация скоропорта' },

  // Уценка при выдаче из остатка кооператива: разница цены прибытия и факта
  // выбывает со склада в прочие расходы (requirement 76, вопрос 4).
  { code: 'o.mkt.loss',    process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'MARKDOWN_LOSS',  wallet_op: 'NONE', wallet_from: null, wallet_to: null,
    debit: 91, credit: 10,
    human_name: 'Уценка имущества при выдаче со склада кооператива' },

  // Членский взнос по заказу (requirement b6 «Экономика КУ»): блокировка по
  // единой ставке кооператива на createorder с паевого, дособор на signiss2.
  { code: 'o.mkt.fee',     process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'MEMBERSHIP_FEE_LOCK', wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.mkt.fee',
    debit: 80, credit: 86,
    human_name: 'Членский взнос «Стола заказов» по заказу' },

  // Возврат неиспользованной части взноса: отмена — полностью, недовыдача —
  // пропорционально факту.
  { code: 'o.mkt.refund',  process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'MEMBERSHIP_FEE_REFUND', wallet_op: 'TRANSFER', wallet_from: 'w.mkt.fee', wallet_to: 'w.mkt.member',
    debit: null, credit: null,
    human_name: 'Возврат членского взноса по заказу' },

  // Членский взнос под заказ из остатка — из уже внесённых членских средств
  // пайщика (stockorder фондируется из членского начисто). Парный по взносу к
  // o.mkt.lockm; инверсия o.mkt.refund. Паевой пополняет членский заранее (o.mkt.conv).
  { code: 'o.mkt.lockmf',  process_type: 'p.mkt.supply',  contract: 'marketplace',
    name: 'LOCK_FEE_FROM_MEMBER', wallet_op: 'TRANSFER', wallet_from: 'w.mkt.member', wallet_to: 'w.mkt.fee',
    debit: null, credit: null,
    human_name: 'Членский взнос «Стола заказов» из внесённых средств' },

  // branch — экономика кооперативного участка (requirement b6)
  { code: 'o.brn.common',  process_type: 'p.brn.fees',    contract: 'branch',
    name: 'DISTRIBUTE_COMMON', wallet_op: 'TRANSFER', wallet_from: 'w.mkt.fee', wallet_to: 'w.brn.common',
    debit: null, credit: null,
    human_name: 'Членский взнос в общий кошелёк кооперативного участка' },

  { code: 'o.brn.release', process_type: 'p.brn.fees',    contract: 'branch',
    name: 'RELEASE_FROM_COMMON', wallet_op: 'TRANSFER', wallet_from: 'w.brn.common', wallet_to: 'w.brn.pool',
    debit: null, credit: null,
    human_name: 'Изъятие из общего кошелька кооперативного участка на распределение' },

  { code: 'o.brn.person',  process_type: 'p.brn.fees',    contract: 'branch',
    name: 'DISTRIBUTE_PERSONAL', wallet_op: 'TRANSFER', wallet_from: 'w.brn.pool', wallet_to: 'w.brn.person',
    debit: null, credit: null,
    human_name: 'Распределение членского взноса доверенному кооперативного участка' },

  { code: 'o.brn.expfnd',  process_type: 'p.brn.spend',   contract: 'branch',
    name: 'EXPENSE_FUND',   wallet_op: 'TRANSFER', wallet_from: 'w.brn.common', wallet_to: 'w.brn.expns',
    debit: null, credit: null,
    human_name: 'Выделение средств кооперативного участка под расход' },

  { code: 'o.brn.expunf',  process_type: 'p.brn.spend',   contract: 'branch',
    name: 'EXPENSE_UNFUND', wallet_op: 'TRANSFER', wallet_from: 'w.brn.expns', wallet_to: 'w.brn.common',
    debit: null, credit: null,
    human_name: 'Возврат неизрасходованных средств в общий кошелёк кооперативного участка' },

  { code: 'o.brn.spend',   process_type: 'p.brn.spend',   contract: 'branch',
    name: 'SPEND_COMMON',   wallet_op: 'BURN', wallet_from: 'w.brn.expns', wallet_to: null,
    debit: 86, credit: 51,
    human_name: 'Прямая оплата расхода кооперативного участка по реквизитам' },

  { code: 'o.brn.expadv',  process_type: 'p.brn.spend',   contract: 'branch',
    name: 'EXPENSE_ADVANCE', wallet_op: 'TRANSFER', wallet_from: 'w.brn.expns', wallet_to: 'w.exp.adv',
    debit: 86, credit: 51,
    human_name: 'Выдача аванса под отчёт по расходу кооперативного участка' },

  { code: 'o.brn.exprpt',  process_type: 'p.brn.spend',   contract: 'branch',
    name: 'EXPENSE_REPORT', wallet_op: 'BURN', wallet_from: 'w.exp.adv', wallet_to: null,
    debit: null, credit: null,
    human_name: 'Закрытие подотчёта по расходу кооперативного участка' },

  { code: 'o.brn.expret',  process_type: 'p.brn.spend',   contract: 'branch',
    name: 'EXPENSE_RETURN', wallet_op: 'TRANSFER', wallet_from: 'w.exp.adv', wallet_to: 'w.brn.expns',
    debit: 51, credit: 86,
    human_name: 'Возврат неиспользованного аванса по расходу кооперативного участка' },

  { code: 'o.brn.expovr',  process_type: 'p.brn.spend',   contract: 'branch',
    name: 'EXPENSE_OVERSPEND', wallet_op: 'TRANSFER', wallet_from: 'w.brn.expns', wallet_to: 'w.exp.adv',
    debit: 86, credit: 51,
    human_name: 'Доплата сверх аванса по расходу кооперативного участка' },

  { code: 'o.brn.aid',     process_type: 'p.brn.aid',     contract: 'branch',
    name: 'FINANCIAL_AID',  wallet_op: 'BURN', wallet_from: 'w.brn.person', wallet_to: null,
    debit: 86, credit: 51,
    human_name: 'Материальная помощь доверенному кооперативного участка' },

  { code: 'o.brn.conv',    process_type: 'p.brn.fees',    contract: 'branch',
    name: 'CONVERT_TO_MKT', wallet_op: 'TRANSFER', wallet_from: 'w.brn.person', wallet_to: 'w.mkt.member',
    debit: null, credit: null,
    human_name: 'Перевод персональных средств доверенного в членский кошелёк «Стола заказов»' },

  // soviet
  { code: 'o.sov.axncnv', process_type: 'p.sov.axncnv', contract: 'soviet', name: 'CONVERT_AXN', wallet_op: 'TRANSFER', wallet_from: 'w.wal.share', wallet_to: 'w.sov.delgte', debit: 80, credit: 86, human_name: 'Трансляция паевого в членский взнос инфраструктуры' },

  // migration
  { code: 'o.mig.minshr', process_type: 'p.mig.trans', contract: 'migration', name: 'MIN_SHARE', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.reg.minshr', debit: 51, credit: 80, human_name: 'Транзит: минимальные паевые взносы' },

  { code: 'o.mig.share', process_type: 'p.mig.trans', contract: 'migration', name: 'SHARE', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.wal.share', debit: 51, credit: 80, human_name: 'Транзит: остаток паевых взносов деньгами' },

  { code: 'o.mig.entry', process_type: 'p.mig.trans', contract: 'migration', name: 'ENTRY', wallet_op: 'ISSUE', wallet_from: null, wallet_to: 'w.reg.entry', debit: 51, credit: 86, human_name: 'Транзит: вступительные взносы' },

  // adjustment (ручные корректировки председателя — динамические параметры,
  // не идут через ledger2::apply; см. operations.hpp `OPERATION_ADJUSTMENT_REGISTRY`).
  { code: 'o.adj.walmove', process_type: 'p.adj.fix', contract: 'ledger2', name: 'WALMOVE', wallet_op: null, wallet_from: null, wallet_to: null, debit: null, credit: null, human_name: 'Перевод между кошельками', kind: 'adjustment' },

  { code: 'o.adj.rev', process_type: 'p.adj.fix', contract: 'ledger2', name: 'REVERSAL', wallet_op: null, wallet_from: null, wallet_to: null, debit: null, credit: null, human_name: 'Откат операции', kind: 'adjustment' },
] as const

const opByCode = new Map<string, OperationMeta>(
  LEDGER2_OPERATION_REGISTRY.map(o => [o.code, o]),
)

export function getOperationMeta(code: string | null | undefined): OperationMeta | undefined {
  if (!code)
    return undefined
  return opByCode.get(code)
}

export function getOperationProcessType(code: string | null | undefined): string | undefined {
  return getOperationMeta(code)?.process_type
}

export function getOperationHumanName(code: string | null | undefined): string | undefined {
  return getOperationMeta(code)?.human_name
}

/**
 * Корректировка председателя (`o.adj.*`) — операция с динамическими параметрами,
 * вызываемая отдельными actions ledger2::walmove / ledger2::revert. UI использует
 * это для фильтра «Только корректировки» и для запрета обычных путей.
 */
export function isAdjustmentOperation(code: string | null | undefined): boolean {
  return !!code && code.startsWith('o.adj.')
}
