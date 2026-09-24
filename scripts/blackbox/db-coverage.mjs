#!/usr/bin/env node
/**
 * Покрытие таблиц базы внешним слоем — карта готовности к уходу с TypeORM
 * (C28-81).
 *
 * Уход с ORM безопасен для таблицы, когда внешние тесты читают и пишут её так
 * же, как это делает платформа: тогда переписанный на Kysely репозиторий
 * проверяется тем же прогоном без правки тестов. Пометок в коде для этого не
 * нужно — Postgres сам ведёт журнал запросов (pg_stat_statements, включён в
 * надстройке компоуза полигона), а stack.sh снимает его по фазам прогона.
 *
 * Здесь журнал разбирается на пары «таблица — чтение/запись», таблица
 * привязывается к файлу сущности (@Entity) и домену, и собирается сводка:
 *   $OUT/db-coverage.json — по таблице: сущность, домен, вызовы по фазам;
 *   $OUT/db-coverage.md   — по доменам: сколько таблиц читается и пишется
 *                            тестами, и какие не тронуты вовсе.
 *
 * Оговорка: в журнал попадает всё, что контроллер делал во время фазы, в том
 * числе фоновые задачи (синхронизация с цепью, кроны). Чтение таблицы кроном
 * засчитывается — это честно для «таблица работает на стенде», но не значит,
 * что её сценарий проверен ассертом.
 *
 * Использование: node scripts/blackbox/db-coverage.mjs [каталог .blackbox]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = path.resolve(process.argv[2] || process.env.BLACKBOX_OUT || path.join(ROOT, '.blackbox'))
const DIR = path.join(OUT, 'dbcov')

const SKIP_TABLES = new Set(['migrations', 'typeorm_metadata', 'pg_stat_statements'])
const SOURCE_ROOTS = ['components/controller/src', 'components/extension-kit/src']

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')) out.push(p)
  }
  return out
}

/** Таблица → файл сущности. Имя из @Entity('x') / @Entity({ name: 'x' }). */
function entityMap() {
  const map = new Map()
  for (const root of SOURCE_ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
      const src = fs.readFileSync(file, 'utf8')
      if (!src.includes('@Entity(')) continue
      // Константы с именем таблицы: const X_TABLE = 'name'
      const consts = new Map([...src.matchAll(/const\s+(\w+)\s*=\s*['"`]([\w]+)['"`]/g)].map(m => [m[1], m[2]]))
      for (const m of src.matchAll(/@Entity\(\s*(?:\{[^}]*?name:\s*)?(?:['"`]([\w]+)['"`]|(\w+))/g)) {
        const name = m[1] ?? consts.get(m[2])
        if (name) map.set(name, path.relative(ROOT, file))
      }
    }
  }
  return map
}

/** Домен по пути файла сущности: расширение или область ядра. */
function domainOf(file) {
  if (!file) return '(не найдена сущность)'
  let m = file.match(/src\/extensions\/([^/]+)\//)
  if (m) return m[1]
  if (file.startsWith('components/extension-kit/')) return 'extension-kit'
  m = file.match(/src\/(?:infrastructure\/database\/typeorm\/entities|domain|application|infrastructure)\/([^/]+)/)
  return m ? `ядро/${m[1].replace(/\.entity\.ts$/, '').replace(/\.ts$/, '')}` : 'ядро'
}

const TABLE_REF = /\b(FROM|JOIN|INTO|UPDATE)\s+(?:ONLY\s+)?(?:"?(\w+)"?\.)?"?([A-Za-z_]\w*)"?/gi

/** Пары [таблица, 'read'|'write'] одного запроса. */
function refsOf(query) {
  const q = query.replace(/'(?:[^']|'')*'/g, "''")
  const head = q.trim().replace(/^\(+/, '').slice(0, 12).toUpperCase()
  if (/^(BEGIN|COMMIT|ROLLBACK|SET|SHOW|SAVEPOINT|RELEASE|START|DEALLOCATE|DISCARD|LISTEN|UNLISTEN|NOTIFY|CREATE|ALTER|DROP|GRANT|COMMENT|VACUUM|ANALYZE|TRUNCATE|LOCK)/.test(head))
    return []
  // Главное действие запроса и где оно начинается: у WITH … DELETE таблицы
  // из CTE читаются, а пишется только цель после DELETE/UPDATE/INSERT.
  const main = /^\s*(?:WITH\b[\s\S]*?\)\s*)?(INSERT|UPDATE|DELETE)\b/i.exec(q)
  const writeKind = main?.[1]?.toUpperCase()
  const writePos = main ? main.index + main[0].length - main[1].length : 0
  const refs = []
  let writeTargetTaken = false
  for (const m of q.matchAll(TABLE_REF)) {
    const kw = m[1].toUpperCase()
    const schema = m[2]
    const table = m[3]
    if (schema && schema !== 'public') continue
    if (/^(pg_|information_schema)/.test(table) || SKIP_TABLES.has(table)) continue
    if (/^(SELECT|LATERAL|UNNEST|generate_series|jsonb_|json_|VALUES)$/i.test(table)) continue
    let kind = 'read'
    if (writeKind && !writeTargetTaken && (m.index ?? 0) >= writePos) {
      if ((writeKind === 'INSERT' && kw === 'INTO') || (writeKind === 'UPDATE' && kw === 'UPDATE') || (writeKind === 'DELETE' && kw === 'FROM')) {
        kind = 'write'
        writeTargetTaken = true
      }
    }
    refs.push([table, kind])
  }
  return refs
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  catch {
    return fallback
  }
}

function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`нет ${DIR} — журнал запросов не снимался`)
    process.exit(0)
  }
  const tables = readJson(path.join(DIR, 'tables.json'), []).flat()
  const phases = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'tables.json').map(f => f.replace(/\.json$/, '')).sort()
  const entities = entityMap()

  const cov = new Map()
  const rowOf = (db, table) => {
    const key = `${db}.${table}`
    if (!cov.has(key)) {
      const entity = entities.get(table) ?? null
      cov.set(key, { db, table, entity, domain: domainOf(entity), read: {}, write: {} })
    }
    return cov.get(key)
  }
  for (const t of tables) {
    if (!SKIP_TABLES.has(t.table)) rowOf(t.db, t.table)
  }

  const known = new Set(tables.map(t => `${t.db}.${t.table}`))
  for (const phase of phases) {
    for (const s of readJson(path.join(DIR, `${phase}.json`), []) ?? []) {
      for (const [table, kind] of refsOf(s.query)) {
        // Имена из запроса, которых нет среди таблиц базы, — CTE и алиасы.
        if (known.size && !known.has(`${s.db}.${table}`)) continue
        const r = rowOf(s.db, table)
        r[kind][phase] = (r[kind][phase] ?? 0) + Number(s.calls)
      }
    }
  }

  const rows = [...cov.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.table.localeCompare(b.table))
  fs.writeFileSync(path.join(OUT, 'db-coverage.json'), JSON.stringify({ phases, tables: rows }, null, 2))

  const touched = (r, kind) => Object.keys(r[kind]).length > 0
  const byDomain = new Map()
  for (const r of rows) {
    const d = byDomain.get(r.domain) ?? { total: 0, read: 0, write: 0, none: [] }
    d.total++
    if (touched(r, 'read')) d.read++
    if (touched(r, 'write')) d.write++
    if (!touched(r, 'read') && !touched(r, 'write')) d.none.push(r.table)
    byDomain.set(r.domain, d)
  }

  const total = rows.length
  const anyTouched = rows.filter(r => touched(r, 'read') || touched(r, 'write')).length
  const written = rows.filter(r => touched(r, 'write')).length
  const lines = []
  lines.push('## База: покрытие таблиц внешним слоем')
  lines.push('')
  lines.push(`Фазы: ${phases.join(', ') || '—'}. Таблиц ${total}, тронуто ${anyTouched}, пишется ${written}, не тронуто ${total - anyTouched}.`)
  lines.push('')
  lines.push('| домен | таблиц | читается | пишется | не тронуто |')
  lines.push('|---|---:|---:|---:|---|')
  for (const [domain, d] of [...byDomain].sort((a, b) => b[1].none.length - a[1].none.length)) {
    const none = d.none.length ? `${d.none.length}: ${d.none.slice(0, 8).join(', ')}${d.none.length > 8 ? ', …' : ''}` : '—'
    lines.push(`| ${domain} | ${d.total} | ${d.read} | ${d.write} | ${none} |`)
  }
  const md = lines.join('\n') + '\n'
  fs.writeFileSync(path.join(OUT, 'db-coverage.md'), md)
  process.stdout.write(md)
}

main()
