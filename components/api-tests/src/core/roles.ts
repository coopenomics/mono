/**
 * Кто есть на стенде. Роли платформы — пайщик (user), член совета (member) и
 * председатель (chairman); поверх них расширения раздают свои: председатель
 * кооперативного участка (branch.trustee), поставщик Стола заказов, оператор
 * ПВЗ. Тест берёт готового участника отсюда, когда проверяет права роли, и
 * свежего пайщика из participants.ts, когда меняет его состояние.
 *
 * Председатель и члены совета заводятся boot:extra с общим ключом стенда.
 * Остальные — фикстуры docs-harness (scripts/blackbox/seed.mjs): их ключи
 * лежат в components/docs-harness/state/participants/<имя>.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Who } from './auth'
import { DEFAULT_WIF, REPO_ROOT } from './env'

export const FIXTURES_DIR = path.join(REPO_ROOT, 'components/docs-harness/state/participants')

/** Председатель кооператива voskhod. */
export const CHAIRMAN: Who = { account: 'ant', email: process.env.TEST_EMAIL || 'ivanov@example.com', wif: DEFAULT_WIF }

/** Член совета с правом голоса (расширенный совет boot:extra). */
export const COUNCIL: Who = { account: 'petr', email: 'sidorov@example.com', wif: DEFAULT_WIF }
export const COUNCIL_2: Who = { account: 'anna', email: 'petrova@example.com', wif: DEFAULT_WIF }

/** Участник из фикстур docs-harness; падает понятно, если засева не было. */
export function fixture(name: string): Who {
  const file = path.join(FIXTURES_DIR, `${name}.json`)
  if (!fs.existsSync(file))
    throw new Error(`нет фикстуры ${file}: нужен засев стенда (scripts/blackbox/stack.sh seed)`)
  const j = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!j.wif)
    throw new Error(`у фикстуры ${name} нет ключа (создана без перезаписи ключа) — нужен чистый стенд`)
  return { account: j.username, email: j.email, wif: j.wif }
}

/**
 * Роли для проверок прав. Функции, а не значения: фикстуры появляются после
 * засева, а модуль импортируется раньше.
 */
export const ROLES = {
  /** Обычный пайщик: подключён к Столу заказов, заказывает. */
  member: () => fixture('ekaterina'),
  /** Второй обычный пайщик — «чужой» для объектов первого. */
  otherMember: () => fixture('ivanpetrov'),
  /** Поставщик Стола заказов. */
  supplier: () => fixture('sidorov'),
  /** Председатель участка krg. */
  branchChairman: () => fixture('chairkrg'),
  /** Председатель участка odn — «чужой» для объектов krg. */
  foreignBranchChairman: () => fixture('chairodn'),
  council: () => COUNCIL,
  chairman: () => CHAIRMAN,
} as const

export type RoleName = keyof typeof ROLES
