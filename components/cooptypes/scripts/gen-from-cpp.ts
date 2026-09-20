/**
 * Кодогенератор: вытягивает реестры из `contracts/cpp/lib/core/ledger2/wallets.hpp`
 * и пишет `src/ledger2/wallets.generated.ts`. Источник истины — C++; TS — копия.
 *
 * Запускать вручную: `pnpm --filter cooptypes gen:from-cpp`
 * Авто-запуск: `prebuild` хук cooptypes (см. package.json).
 *
 * Парсер строгий: не понял реестр — кидает ошибку (а не молча выкатывает старый
 * файл). Snapshot-тест в `test/wallets-registry.snapshot.test.ts` ловит изменения
 * формата `wallets.hpp` или регрессию парсера.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HPP_PATH = resolve(__dirname, '../../contracts/cpp/lib/core/ledger2/wallets.hpp')
const EXIT_HPP_PATH = resolve(__dirname, '../../contracts/cpp/lib/core/ledger2/exit_policy.hpp')
const OPS_HPP_PATH = resolve(__dirname, '../../contracts/cpp/lib/core/ledger2/operations.hpp')
const OUT_PATH = resolve(__dirname, '../src/ledger2/wallets.generated.ts')

const hpp = readFileSync(HPP_PATH, 'utf8')
const exitHpp = readFileSync(EXIT_HPP_PATH, 'utf8')
const opsHpp = readFileSync(OPS_HPP_PATH, 'utf8')

// ── 1. ledger2_wallets:: NAME = "w.x.y"_n; ─────────────────────────────
const nameMap = new Map<string, string>()
{
  const re = /static\s+constexpr\s+eosio::name\s+(\w+)\s*=\s*"([^"]+)"_n\s*;/g
  for (const m of hpp.matchAll(re)) nameMap.set(m[1]!, m[2]!)
  if (nameMap.size === 0) throw new Error('gen-from-cpp: не найдены ledger2_wallets:: имена')
}

// ── 2. enum class WalletKind { USER_SHARED = 0, COOPERATIVE = 1 } ───────
const kindMap = new Map<string, number>()
{
  const m = /enum\s+class\s+WalletKind\s*:\s*\w+\s*\{([^}]+)\}/.exec(hpp)
  if (!m) throw new Error('gen-from-cpp: enum WalletKind не найден')
  for (const line of m[1]!.split(/\r?\n/)) {
    const em = /(\w+)\s*=\s*(\d+)/.exec(line)
    if (em) kindMap.set(em[1]!, Number.parseInt(em[2]!, 10))
  }
  if (!kindMap.has('USER_SHARED') || !kindMap.has('COOPERATIVE'))
    throw new Error('gen-from-cpp: WalletKind должен содержать USER_SHARED и COOPERATIVE')
}

// ── 3. extract `VAR = {{ … }};` body ─────────────────────────────────────
function extractArrayBody(varName: string): string {
  const open = `${varName} = {{`
  const start = hpp.indexOf(open)
  if (start === -1) throw new Error(`gen-from-cpp: ${varName} = {{ ... }} не найдено`)
  const bodyStart = start + open.length
  const end = hpp.indexOf('}};', bodyStart)
  if (end === -1) throw new Error(`gen-from-cpp: закрывающее }}; для ${varName} не найдено`)
  return hpp.slice(bodyStart, end)
}

// ── 4. LEDGER2_WALLET_REGISTRY ───────────────────────────────────────────
interface WalletEntry { name: string, human_name: string, kind: 'USER_SHARED' | 'COOPERATIVE' }
const walletRegistry: WalletEntry[] = []
{
  const body = extractArrayBody('LEDGER2_WALLET_REGISTRY')
  const re = /\{\s*ledger2_wallets::(\w+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*WalletKind::(\w+)\s*\}/g
  for (const m of body.matchAll(re)) {
    const [, ident, human, kind] = m
    const name = nameMap.get(ident!)
    if (!name) throw new Error(`gen-from-cpp: ledger2_wallets::${ident} не найден среди имён`)
    if (kind !== 'USER_SHARED' && kind !== 'COOPERATIVE')
      throw new Error(`gen-from-cpp: неизвестный WalletKind::${kind}`)
    walletRegistry.push({ name, human_name: human!, kind })
  }
  if (walletRegistry.length === 0) throw new Error('gen-from-cpp: LEDGER2_WALLET_REGISTRY пуст')
  // Проверяем декларированный размер `std::array<…, N>`.
  const sizeMatch = /std::array<Ledger2WalletMeta,\s*(\d+)>\s+LEDGER2_WALLET_REGISTRY/.exec(hpp)
  if (sizeMatch && Number(sizeMatch[1]) !== walletRegistry.length)
    throw new Error(`gen-from-cpp: распарсено ${walletRegistry.length} записей, объявлено ${sizeMatch[1]}`)
  // Проверяем уникальность имён.
  const seen = new Set<string>()
  for (const w of walletRegistry) {
    if (seen.has(w.name)) throw new Error(`gen-from-cpp: дубликат wallet_name "${w.name}"`)
    seen.add(w.name)
  }
}

// ── 5. LEDGER2_USER_SHARED_PROGRAM_MAPPING ───────────────────────────────
interface ProgramMappingEntry { wallet_name: string, required_program_id: number, program_label: string | null }
const programMapping: ProgramMappingEntry[] = []
{
  const body = extractArrayBody('LEDGER2_USER_SHARED_PROGRAM_MAPPING')
  const re = /\{\s*ledger2_wallets::(\w+)\s*,\s*(\d+)\s*(?:\/\*\s*([\s\S]*?)\s*\*\/)?\s*\}/g
  for (const m of body.matchAll(re)) {
    const [, ident, idStr, comment] = m
    const wallet_name = nameMap.get(ident!)
    if (!wallet_name) throw new Error(`gen-from-cpp: ledger2_wallets::${ident} не найден среди имён`)
    const required_program_id = Number.parseInt(idStr!, 10)
    // Комментарий вида "/* ЦК */" интерпретируем как program_label только когда program_id > 0.
    // Для program_id == 0 комментарий часто содержит "wallet_name — без проверки" — это не label.
    const program_label = required_program_id > 0 ? (comment?.trim() ?? null) : null
    programMapping.push({ wallet_name, required_program_id, program_label })
  }
  if (programMapping.length === 0) throw new Error('gen-from-cpp: LEDGER2_USER_SHARED_PROGRAM_MAPPING пуст')
  const sizeMatch = /std::array<Ledger2WalletProgramMapping,\s*(\d+)>\s+LEDGER2_USER_SHARED_PROGRAM_MAPPING/.exec(hpp)
  if (sizeMatch && Number(sizeMatch[1]) !== programMapping.length)
    throw new Error(`gen-from-cpp: распарсено ${programMapping.length} mapping-записей, объявлено ${sizeMatch[1]}`)
  // Все wallet_name в маппинге должны существовать в реестре.
  const known = new Set(walletRegistry.map(w => w.name))
  for (const m of programMapping) {
    if (!known.has(m.wallet_name))
      throw new Error(`gen-from-cpp: маппинг ссылается на отсутствующий в реестре кошелёк "${m.wallet_name}"`)
  }
}

// ── 5b. EXIT_WALLET_POLICY (exit_policy.hpp) ─────────────────────────────
// Что выход делает с кошельком пайщика: MAIN — цель сбора, RETURN_TO_MAIN —
// возвращается (с операцией переноса), FORFEIT — остаётся кооперативу,
// BLOCKER — ненулевой остаток держит выход, UNTOUCHED — выход не трогает.
// Единый источник для контракта (confirmexit) и backend-preview.
type ExitPolicy = 'MAIN' | 'RETURN_TO_MAIN' | 'FORFEIT' | 'BLOCKER' | 'UNTOUCHED'
interface ExitRuleEntry { wallet_name: string, policy: ExitPolicy, transfer_op: string | null, note: string }
const exitPolicy: ExitRuleEntry[] = []
{
  // operations::<contract>::NAME = "o.x.y"_n — нужны коды операций переноса.
  const opMap = new Map<string, string>()
  for (const m of opsHpp.matchAll(/inline\s+constexpr\s+eosio::name\s+(\w+)\s*=\s*"([^"]+)"_n\s*;/g)) {
    opMap.set(m[1]!, m[2]!)
  }
  const open = 'EXIT_WALLET_POLICY[] = {'
  const start = exitHpp.indexOf(open)
  if (start === -1) throw new Error('gen-from-cpp: EXIT_WALLET_POLICY[] = { ... } не найдено')
  const end = exitHpp.indexOf('\n};', start)
  if (end === -1) throw new Error('gen-from-cpp: закрывающее }; для EXIT_WALLET_POLICY не найдено')
  const body = exitHpp.slice(start + open.length, end)
  const re = /\{\s*ledger2_wallets::(\w+)\s*,\s*ExitWalletPolicy::(\w+)\s*,\s*(eosio::name\{\}|operations::\w+::(\w+))\s*,\s*"([^"]*)"\s*\}/g
  const allowed: ExitPolicy[] = ['MAIN', 'RETURN_TO_MAIN', 'FORFEIT', 'BLOCKER', 'UNTOUCHED']
  for (const m of body.matchAll(re)) {
    const [, ident, policy, opExpr, opIdent, note] = m
    const wallet_name = nameMap.get(ident!)
    if (!wallet_name) throw new Error(`gen-from-cpp: ledger2_wallets::${ident} не найден среди имён`)
    if (!allowed.includes(policy as ExitPolicy)) throw new Error(`gen-from-cpp: неизвестная ExitWalletPolicy::${policy}`)
    let transfer_op: string | null = null
    if (opExpr !== 'eosio::name{}') {
      transfer_op = opMap.get(opIdent!) ?? null
      if (!transfer_op) throw new Error(`gen-from-cpp: операция ${opExpr} не найдена в operations.hpp`)
    }
    exitPolicy.push({ wallet_name, policy: policy as ExitPolicy, transfer_op, note: note! })
  }
  if (exitPolicy.length === 0) throw new Error('gen-from-cpp: EXIT_WALLET_POLICY пуст')
  // Каждый USER_SHARED-кошелёк реестра обязан иметь строку — как в C++ static_assert.
  const known = new Set(walletRegistry.map(w => w.name))
  for (const r of exitPolicy) {
    if (!known.has(r.wallet_name))
      throw new Error(`gen-from-cpp: политика выхода ссылается на отсутствующий в реестре кошелёк "${r.wallet_name}"`)
  }
  const covered = new Set(exitPolicy.map(r => r.wallet_name))
  for (const w of walletRegistry) {
    if (w.kind === 'USER_SHARED' && !covered.has(w.name))
      throw new Error(`gen-from-cpp: у кошелька "${w.name}" нет политики выхода в EXIT_WALLET_POLICY`)
  }
}
const exitRefundWallets = exitPolicy
  .filter(r => r.policy === 'MAIN' || r.policy === 'RETURN_TO_MAIN')
  .map(r => r.wallet_name)

// ── 6. emit TS ───────────────────────────────────────────────────────────
const lines: string[] = []
lines.push('// AUTO-GENERATED by cooptypes/scripts/gen-from-cpp.ts — DO NOT EDIT.')
lines.push('// Source: contracts/cpp/lib/core/ledger2/wallets.hpp')
lines.push('// Run `pnpm --filter cooptypes gen:from-cpp` to regenerate.')
lines.push('')
lines.push('import type { IName } from \'../interfaces/ledger2\'')
lines.push('')
lines.push('export type WalletKind = \'USER_SHARED\' | \'COOPERATIVE\'')
lines.push('')
lines.push('export interface WalletMeta {')
lines.push('  /** Машинный идентификатор — eosio::name в контракте. */')
lines.push('  name: IName')
lines.push('  /** Человекочитаемое название для UI. */')
lines.push('  human_name: string')
lines.push('  /** Тип кошелька: USER_SHARED — L3-разрез по пайщику; COOPERATIVE — единый баланс. */')
lines.push('  kind: WalletKind')
lines.push('}')
lines.push('')
lines.push('/**')
lines.push(' * Реестр кошельков ledger2 — точная копия `LEDGER2_WALLET_REGISTRY` из C++.')
lines.push(' */')
lines.push('export const LEDGER2_WALLET_REGISTRY: readonly WalletMeta[] = [')
for (const w of walletRegistry) {
  lines.push(`  { name: ${JSON.stringify(w.name)}, human_name: ${JSON.stringify(w.human_name)}, kind: ${JSON.stringify(w.kind)} },`)
}
lines.push('] as const')
lines.push('')
lines.push('export interface ProgramWalletMapping {')
lines.push('  /** Машинный идентификатор кошелька. */')
lines.push('  wallet_name: IName')
lines.push('  /** Требуемый program_id для cross-contract проверки в `wallet::users.programs[]`; 0 — без проверки. */')
lines.push('  required_program_id: number')
lines.push('  /** Человекочитаемая метка программы из inline-комментария hpp; null для program_id == 0. */')
lines.push('  program_label: string | null')
lines.push('}')
lines.push('')
lines.push('/**')
lines.push(' * Маппинг USER_SHARED-кошелька → program_id (`LEDGER2_USER_SHARED_PROGRAM_MAPPING`).')
lines.push(' * N→1: один program_id может ссылаться на несколько wallet_name (ЦК = share + member).')
lines.push(' */')
lines.push('export const LEDGER2_USER_SHARED_PROGRAM_MAPPING: readonly ProgramWalletMapping[] = [')
for (const m of programMapping) {
  lines.push(`  { wallet_name: ${JSON.stringify(m.wallet_name)}, required_program_id: ${m.required_program_id}, program_label: ${m.program_label === null ? 'null' : JSON.stringify(m.program_label)} },`)
}
lines.push('] as const')
lines.push('')
lines.push('/** Что выход из кооператива делает с кошельком пайщика. */')
lines.push("export type ExitWalletPolicy = 'MAIN' | 'RETURN_TO_MAIN' | 'FORFEIT' | 'BLOCKER' | 'UNTOUCHED'")
lines.push('')
lines.push('export interface ExitWalletRule {')
lines.push('  /** Машинный идентификатор кошелька. */')
lines.push('  wallet_name: IName')
lines.push('  /** MAIN — главный паевой, цель сбора; RETURN_TO_MAIN — возвращается пайщику; FORFEIT — остаётся кооперативу; BLOCKER — ненулевой остаток держит выход; UNTOUCHED — выход не трогает. */')
lines.push('  policy: ExitWalletPolicy')
lines.push('  /** Операция переноса на главный паевой; null у всех политик, кроме RETURN_TO_MAIN. */')
lines.push('  transfer_op: IName | null')
lines.push('  /** Для BLOCKER — причина отказа пайщику; для остальных — пояснение к решению. */')
lines.push('  note: string')
lines.push('}')
lines.push('')
lines.push('/**')
lines.push(' * Что выход делает с каждым кошельком пайщика — точная копия `EXIT_WALLET_POLICY`')
lines.push(' * из C++ (lib/core/ledger2/exit_policy.hpp). Контракт `confirmexit` обходит эту')
lines.push(' * таблицу, собирает доступные балансы возвращаемых кошельков и ставит их на')
lines.push(' * возврат; предрасчёт на столе считает по ней же — суммы совпадают.')
lines.push(' */')
lines.push('export const LEDGER2_EXIT_WALLET_POLICY: readonly ExitWalletRule[] = [')
for (const r of exitPolicy) {
  lines.push(`  { wallet_name: ${JSON.stringify(r.wallet_name)}, policy: ${JSON.stringify(r.policy)}, transfer_op: ${r.transfer_op === null ? 'null' : JSON.stringify(r.transfer_op)}, note: ${JSON.stringify(r.note)} },`)
}
lines.push('] as const')
lines.push('')
lines.push('/**')
lines.push(' * Кошельки, остатки которых возвращаются пайщику при выходе, — выведено из')
lines.push(' * таблицы политики (MAIN + RETURN_TO_MAIN).')
lines.push(' */')
lines.push('export const LEDGER2_EXIT_REFUND_WALLETS: readonly IName[] = [')
for (const w of exitRefundWallets) {
  lines.push(`  ${JSON.stringify(w)},`)
}
lines.push('] as const')
lines.push('')

writeFileSync(OUT_PATH, lines.join('\n'), 'utf8')
console.log(`gen-from-cpp: записано ${OUT_PATH} (wallets=${walletRegistry.length}, mapping=${programMapping.length}, exitPolicy=${exitPolicy.length}, exitRefund=${exitRefundWallets.length})`)
