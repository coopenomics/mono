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
const OPERATIONS_HPP_TEXT = readFileSync(resolve(__dirname, '../../contracts/cpp/lib/core/ledger2/operations.hpp'), 'utf8')
const OUT_PATH = resolve(__dirname, '../src/ledger2/wallets.generated.ts')

const hpp = readFileSync(HPP_PATH, 'utf8')

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

// ── 5b. LEDGER2_EXIT_REFUND_WALLETS ──────────────────────────────────────
// Сет паевых кошельков, возвращаемых пайщику при выходе. Простой массив имён
// `ledger2_wallets::NAME` — единый источник для контракта (confirmexit) и
// backend-preview.
const exitRefundWallets: string[] = []
{
  const body = extractArrayBody('LEDGER2_EXIT_REFUND_WALLETS')
  const re = /ledger2_wallets::(\w+)/g
  for (const m of body.matchAll(re)) {
    const wallet_name = nameMap.get(m[1]!)
    if (!wallet_name) throw new Error(`gen-from-cpp: ledger2_wallets::${m[1]} не найден среди имён`)
    exitRefundWallets.push(wallet_name)
  }
  if (exitRefundWallets.length === 0) throw new Error('gen-from-cpp: LEDGER2_EXIT_REFUND_WALLETS пуст')
  const sizeMatch = /std::array<eosio::name,\s*(\d+)>\s+LEDGER2_EXIT_REFUND_WALLETS/.exec(hpp)
  if (sizeMatch && Number(sizeMatch[1]) !== exitRefundWallets.length)
    throw new Error(`gen-from-cpp: распарсено ${exitRefundWallets.length} exit-refund-кошельков, объявлено ${sizeMatch[1]}`)
  const known = new Set(walletRegistry.map(w => w.name))
  for (const w of exitRefundWallets) {
    if (!known.has(w)) throw new Error(`gen-from-cpp: exit-refund ссылается на отсутствующий в реестре кошелёк "${w}"`)
  }
}

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
lines.push('/**')
lines.push(' * Сет паевых («боевых») кошельков пайщика, возвращаемых при выходе из кооператива.')
lines.push(' * Точная копия `LEDGER2_EXIT_REFUND_WALLETS` из C++. Контракт `confirmexit` обходит')
lines.push(' * этот сет, собирает доступные балансы и ставит их на возврат; backend-preview')
lines.push(' * считает по нему же — расчёт на фронте всегда совпадает с тем, что вернёт контракт.')
lines.push(' */')
lines.push('export const LEDGER2_EXIT_REFUND_WALLETS: readonly IName[] = [')
for (const w of exitRefundWallets) {
  lines.push(`  ${JSON.stringify(w)},`)
}
lines.push('] as const')
lines.push('')

writeFileSync(OUT_PATH, lines.join('\n'), 'utf8')
console.log(`gen-from-cpp: записано ${OUT_PATH} (wallets=${walletRegistry.length}, mapping=${programMapping.length}, exitRefund=${exitRefundWallets.length})`)

// ── 7. Реестр обеспечения беспроцентных займов (contracts/cpp/lib/core/debt/collateral.hpp) ──
// Запись реестра: ключ, кошелёк-источник, кошелёк обеспечения, операции
// блокировки/возврата/обращения, контракт-владелец и его действие согласования,
// тип и номер шаблона основания договора, наименование обеспечения для документов.
{
  const COLLATERAL_HPP = resolve(__dirname, '../../contracts/cpp/lib/core/debt/collateral.hpp')
  const COLLATERAL_OUT = resolve(__dirname, '../src/debt/collateral.generated.ts')
  const chpp = readFileSync(COLLATERAL_HPP, 'utf8')

  const walletConst = (token: string): string => {
    const t = token.trim()
    const m = /^ledger2_wallets::(\w+)$/.exec(t)
    if (!m) throw new Error(`gen-from-cpp: collateral — ожидался ledger2_wallets::NAME, получено "${t}"`)
    const name = nameMap.get(m[1])
    if (!name || !walletRegistry.some(x => x.name === name)) throw new Error(`gen-from-cpp: collateral ссылается на отсутствующий кошелёк ${m[1]}`)
    return name
  }
  const nameLit = (token: string): string => {
    const t = token.trim()
    const m = /^"([a-z1-5.]+)"_n$/.exec(t)
    if (m) return m[1]
    if (t === '_capital') return 'capital'
    if (t === '_debt') return 'debt'
    if (t === 'eosio::name{}') return ''
    throw new Error(`gen-from-cpp: collateral — непонятное имя "${t}"`)
  }
  const opConst = (token: string): string => {
    const t = token.trim()
    const m = /^operations::(\w+)::(\w+)$/.exec(t)
    if (!m) throw new Error(`gen-from-cpp: collateral — ожидалась operations::ns::NAME, получено "${t}"`)
    const re = new RegExp(`namespace\\s+${m[1]}\\s*\\{[\\s\\S]*?inline constexpr eosio::name\\s+${m[2]}\\s*=\\s*"([a-z1-5.]+)"_n`)
    const found = re.exec(OPERATIONS_HPP_TEXT)
    if (!found) throw new Error(`gen-from-cpp: операция ${t} не найдена в operations.hpp`)
    return found[1]
  }

  const open = 'DEBT_COLLATERAL_REGISTRY = {{'
  const start = chpp.indexOf(open)
  if (start < 0) throw new Error('gen-from-cpp: DEBT_COLLATERAL_REGISTRY не найден')
  const bodyStart = start + open.length
  const end = chpp.indexOf('}};', bodyStart)
  const body = chpp.slice(bodyStart, end)

  type Collateral = { key: string, source_wallet: string, pledge_wallet: string, pledge_op: string, unpledge_op: string, seize_op: string, owner_contract: string, sync_action: string, basis_type: 'UHD' | 'OFFER', basis_registry_id: number, human_name: string }
  const entries: Collateral[] = []
  const entryRe = /\{\s*([\s\S]*?)\s*\}\s*,/g
  let em: RegExpExecArray | null
  while ((em = entryRe.exec(body)) !== null) {
    const inner = em[1]
    const strM = /"((?:[^"\\]|\\.)*)"\s*$/.exec(inner.trim())
    if (!strM) throw new Error('gen-from-cpp: collateral — запись без наименования')
    const human_name = strM[1]
    const head = inner.trim().slice(0, inner.trim().length - strM[0].length).replace(/,\s*$/, '')
    const parts = head.split(',').map(x => x.trim()).filter(Boolean)
    if (parts.length !== 10) throw new Error(`gen-from-cpp: collateral — ожидалось 10 полей, получено ${parts.length}: ${head}`)
    const bt = /BasisType::(\w+)/.exec(parts[8])
    if (!bt || (bt[1] !== 'UHD' && bt[1] !== 'OFFER')) throw new Error(`gen-from-cpp: collateral — тип основания "${parts[8]}"`)
    entries.push({
      key: nameLit(parts[0]),
      source_wallet: walletConst(parts[1]),
      pledge_wallet: walletConst(parts[2]),
      pledge_op: opConst(parts[3]),
      unpledge_op: opConst(parts[4]),
      seize_op: opConst(parts[5]),
      owner_contract: nameLit(parts[6]),
      sync_action: nameLit(parts[7]),
      basis_type: bt[1] as 'UHD' | 'OFFER',
      basis_registry_id: Number(parts[9]),
      human_name,
    })
  }
  const sizeM = /std::array<CollateralEntry,\s*(\d+)>\s+DEBT_COLLATERAL_REGISTRY/.exec(chpp)
  if (!sizeM || Number(sizeM[1]) !== entries.length)
    throw new Error(`gen-from-cpp: collateral — распарсено ${entries.length}, объявлено ${sizeM?.[1]}`)

  const out: string[] = []
  out.push('// AUTO-GENERATED by cooptypes/scripts/gen-from-cpp.ts — DO NOT EDIT.')
  out.push('// Source: contracts/cpp/lib/core/debt/collateral.hpp')
  out.push('// Run `pnpm --filter cooptypes gen:from-cpp` to regenerate.')
  out.push('')
  out.push('import type { IName } from \'../interfaces/ledger2\'')
  out.push('')
  out.push('/** Тип основания договора займа: договор об участии в хозяйственной деятельности или оферта программы. */')
  out.push('export type CollateralBasisType = \'UHD\' | \'OFFER\'')
  out.push('')
  out.push('export interface CollateralMeta {')
  out.push('  /** Ключ обеспечения — передаётся в действие createloan. */')
  out.push('  key: IName')
  out.push('  /** Кошелёк пайщика, с которого берётся обеспечение. */')
  out.push('  source_wallet: IName')
  out.push('  /** Кошелёк обеспечения на время займа. */')
  out.push('  pledge_wallet: IName')
  out.push('  /** Операции ledger2: блокировка, возврат, обращение в пользу кооператива. */')
  out.push('  pledge_op: IName')
  out.push('  unpledge_op: IName')
  out.push('  seize_op: IName')
  out.push('  /** Контракт программы-владельца и его действие согласования; пусто — без согласования. */')
  out.push('  owner_contract: IName')
  out.push('  sync_action: IName')
  out.push('  /** Основание договора займа и номер шаблона документа-основания в реестре документов. */')
  out.push('  basis_type: CollateralBasisType')
  out.push('  basis_registry_id: number')
  out.push('  /** Наименование обеспечения для текста заявления и договора. */')
  out.push('  human_name: string')
  out.push('}')
  out.push('')
  out.push('/**')
  out.push(' * Реестр обеспечения беспроцентных займов — точная копия `DEBT_COLLATERAL_REGISTRY` из C++.')
  out.push(' */')
  out.push('export const DEBT_COLLATERAL_REGISTRY: readonly CollateralMeta[] = [')
  for (const c of entries) {
    out.push(`  { key: ${JSON.stringify(c.key)}, source_wallet: ${JSON.stringify(c.source_wallet)}, pledge_wallet: ${JSON.stringify(c.pledge_wallet)}, pledge_op: ${JSON.stringify(c.pledge_op)}, unpledge_op: ${JSON.stringify(c.unpledge_op)}, seize_op: ${JSON.stringify(c.seize_op)}, owner_contract: ${JSON.stringify(c.owner_contract)}, sync_action: ${JSON.stringify(c.sync_action)}, basis_type: ${JSON.stringify(c.basis_type)}, basis_registry_id: ${c.basis_registry_id}, human_name: ${JSON.stringify(c.human_name)} },`)
  }
  out.push('] as const')
  out.push('')
  writeFileSync(COLLATERAL_OUT, out.join('\n'), 'utf8')
  console.log(`gen-from-cpp: записано ${COLLATERAL_OUT} (collateral=${entries.length})`)
}
