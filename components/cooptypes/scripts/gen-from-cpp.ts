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

writeFileSync(OUT_PATH, lines.join('\n'), 'utf8')
console.log(`gen-from-cpp: записано ${OUT_PATH} (wallets=${walletRegistry.length}, mapping=${programMapping.length})`)
