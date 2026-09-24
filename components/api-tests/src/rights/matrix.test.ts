/**
 * Матрица прав: каждая операция схемы от лица каждой роли.
 *
 * Ожидание берётся из декораторов резолверов (static.ts), факт — из вызова с
 * заведомо чужими аргументами (schema.ts), исход классифицируется по коду
 * ответа (classify.ts). Находки:
 *  - гость прошёл туда, где стоит проверка входа;
 *  - роль вне списка @AuthRoles прошла проверку прав;
 *  - роль из списка получила отказ гварда (обещание устарело или гвард строже);
 *  - расхождение с утверждённым снимком (snapshot.json) — новая операция или
 *    изменившееся право.
 *
 * Отчёт — $RIGHTS_OUT/{matrix.json,summary.md,snapshot.candidate.json}.
 * Фаза идёт последней: мутации с чужими аргументами, прошедшие проверку прав,
 * могут поменять стенд.
 */
import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Who } from '../core/auth'
import { login } from '../core/auth'
import { gqlRaw } from '../core/client'
import type { GqlError } from '../core/client'
import { CHAIRMAN, COUNCIL, fixture } from '../core/roles'
import { classify, isDenied, type Outcome } from './classify'
import { type Operation, SchemaModel } from './schema'
import { type DeclaredOp, type PlatformRole, declaredOps, expectedFor } from './static'

interface MatrixRole { name: string, platform: PlatformRole, who: () => Who | null }

const ROLES: MatrixRole[] = [
  { name: 'guest', platform: 'guest', who: () => null },
  { name: 'member', platform: 'user', who: () => fixture('ekaterina') },
  { name: 'supplier', platform: 'user', who: () => fixture('sidorov') },
  { name: 'branchChairman', platform: 'user', who: () => fixture('chairkrg') },
  { name: 'council', platform: 'member', who: () => COUNCIL },
  { name: 'chairman', platform: 'chairman', who: () => CHAIRMAN },
]

interface Cell { outcome: Outcome, code: string | null, message: string | null }
type Matrix = Record<string, Record<string, Cell>>

const OUT = process.env.RIGHTS_OUT || path.resolve('.rights')
const SNAPSHOT = path.join(path.dirname(new URL(import.meta.url).pathname), 'snapshot.json')

const matrix: Matrix = {}
const sessionKillers = new Set<string>()
/** Операции, вызванные ролью после последнего вызова, где её вход проверялся. */
const sinceAuthCheck = new Map<string, string[]>()
let ops: Operation[] = []
let declared = new Map<string, DeclaredOp>()

function short(err: GqlError | null): Pick<Cell, 'code' | 'message'> {
  return { code: err?.code === null || err?.code === undefined ? null : String(err.code), message: err ? err.message.slice(0, 160) : null }
}

async function call(op: Operation, role: MatrixRole, tokens: Map<string, string | null>): Promise<Cell> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await gqlRaw(tokens.get(role.name) ?? null, op.document, op.variables)
    const err = r.errors[0] ?? null
    const outcome = classify(err)
    // Сессию закрыла предыдущая операция (выход, смена ключа) — войти заново
    // и повторить: иначе все следующие вызовы роли выглядели бы как отказ.
    // Открытые операции токен не смотрят, поэтому виновник — одна из
    // операций после последнего вызова, где вход роли проверялся.
    if (role.platform !== 'guest' && err?.code === 'AUTH_SESSION_TERMINATED' && attempt === 0) {
      sessionKillers.add(`${role.name}: ${(sinceAuthCheck.get(role.name) ?? []).join(' | ')}`)
      tokens.set(role.name, await login(role.who()!))
      continue
    }
    if (outcome === 'throttled' && attempt < 3) {
      // timing: backoff — окно ограничения частоты гварда
      await new Promise(res => setTimeout(res, 20_000))
      continue
    }
    if (outcome === 'deny-auth' && role.platform !== 'guest' && String(err?.code) === '401' && attempt === 0) {
      // Токен мог истечь за долгий прогон — один повторный вход.
      tokens.set(role.name, await login(role.who()!))
      continue
    }
    const guarded = declared.get(op.name)?.guards.includes('GqlJwtAuthGuard') ?? false
    if (guarded && outcome !== 'deny-auth')
      sinceAuthCheck.set(role.name, [op.name])
    else sinceAuthCheck.set(role.name, [...(sinceAuthCheck.get(role.name) ?? []), op.name])
    return { outcome, ...short(err) }
  }
  return { outcome: 'throttled', code: null, message: 'повторы исчерпаны' }
}

function coarse(o: Outcome): 'deny' | 'pass' | null {
  if (isDenied(o))
    return 'deny'
  return o === 'pass' ? 'pass' : null
}

describe('матрица прав', () => {
  beforeAll(async () => {
    const tokens = new Map<string, string | null>()
    for (const r of ROLES) {
      const who = r.who()
      tokens.set(r.name, who ? await login(who) : null)
    }
    const schema = await SchemaModel.load(tokens.get('chairman')!)
    ops = schema.operations().filter(o => !o.hasUpload)
    declared = new Map(declaredOps().map(d => [d.name, d]))
    // Запросы раньше мутаций: мутация с чужими аргументами может поменять
    // стенд, а чтения должны видеть его таким, каким его оставили сценарии.
    ops.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'query' ? -1 : 1))
    for (const op of ops) {
      matrix[op.name] = {}
      for (const role of ROLES)
        matrix[op.name][role.name] = await call(op, role, tokens)
    }
    report()
  }, 40 * 60_000)

  it('матрица снята: вызовы валидны по схеме', () => {
    const invalid = Object.entries(matrix).filter(([, row]) => Object.values(row).some(c => c.outcome === 'invalid')).map(([op]) => op)
    expect(ops.length).toBeGreaterThan(400)
    // Невалидный вызов — дефект генератора аргументов: право не проверено.
    expect(invalid.length / ops.length).toBeLessThan(0.05)
  })

  it('гость не проходит туда, где стоит проверка входа', () => {
    expect(findings().guestPassed).toEqual([])
  })

  it('роль вне списка @AuthRoles не проходит проверку прав', () => {
    expect(findings().roleEscalated).toEqual([])
  })

  it('права совпадают с утверждённым снимком', () => {
    if (!fs.existsSync(SNAPSHOT))
      return
    expect(snapshotDrift()).toEqual([])
  })
})

function findings() {
  const guestPassed: string[] = []
  const roleEscalated: string[] = []
  const roleDenied: string[] = []
  for (const [opName, row] of Object.entries(matrix)) {
    const d = declared.get(opName)
    if (!d)
      continue
    for (const role of ROLES) {
      const cell = row[role.name]
      const expected = expectedFor(d, role.platform)
      if (expected === 'deny' && cell.outcome === 'pass') {
        const line = `${opName} — ${role.name} прошёл (${d.file})`
        if (role.platform === 'guest')
          guestPassed.push(line)
        else roleEscalated.push(line)
      }
      if (expected === 'allow' && (cell.outcome === 'deny-role' || cell.outcome === 'deny-auth'))
        roleDenied.push(`${opName} — ${role.name}: ${cell.code ?? ''} ${cell.message ?? ''}`.trim())
    }
  }
  return { guestPassed, roleEscalated, roleDenied }
}

function candidate(): Record<string, Record<string, 'deny' | 'pass' | null>> {
  const out: Record<string, Record<string, 'deny' | 'pass' | null>> = {}
  for (const [op, row] of Object.entries(matrix)) {
    out[op] = {}
    for (const role of ROLES) out[op][role.name] = coarse(row[role.name].outcome)
  }
  return out
}

function snapshotDrift(): string[] {
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as Record<string, Record<string, 'deny' | 'pass' | null>>
  const now = candidate()
  const drift: string[] = []
  for (const [op, row] of Object.entries(now)) {
    if (!snap[op]) {
      drift.push(`${op}: новой операции нет в снимке — утвердить её права`)
      continue
    }
    for (const [role, v] of Object.entries(row)) {
      const was = snap[op][role]
      if (v && was && v !== was)
        drift.push(`${op} — ${role}: было ${was}, стало ${v}`)
    }
  }
  return drift
}

function report(): void {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'matrix.json'), JSON.stringify(matrix, null, 2))
  fs.writeFileSync(path.join(OUT, 'snapshot.candidate.json'), `${JSON.stringify(candidate(), null, 2)}\n`)
  const f = findings()
  const count = (o: Outcome) => Object.values(matrix).flatMap(r => Object.values(r)).filter(c => c.outcome === o).length
  const lines = [
    '## Матрица прав',
    '',
    `Операций ${ops.length}, ролей ${ROLES.length} (${ROLES.map(r => r.name).join(', ')}). Исходы: pass ${count('pass')}, deny-auth ${count('deny-auth')}, deny-role ${count('deny-role')}, deny-service ${count('deny-service')}, invalid ${count('invalid')}, throttled ${count('throttled')}.`,
    '',
  ]
  const section = (title: string, items: string[]) => {
    lines.push(`**${title}: ${items.length}**`, '')
    for (const i of items.slice(0, 80)) lines.push(`- ${i}`)
    if (items.length > 80)
      lines.push(`- … ещё ${items.length - 80}`)
    lines.push('')
  }
  section('Гость прошёл закрытую операцию', f.guestPassed)
  section('Роль вне @AuthRoles прошла', f.roleEscalated)
  section('Роль из @AuthRoles получила отказ гварда', f.roleDenied)
  section('Сессию роли закрыла одна из операций', [...sessionKillers])
  // Прошедшие проверку прав вызовы с чужими аргументами должны получать
  // деловую ошибку (4xx, код домена). 500 значит, что вход не проверен и
  // упал глубже: разбор uuid в базе, ассерт цепи, голый Error.
  const crashes = Object.entries(matrix).flatMap(([op, row]) => {
    const c = Object.entries(row).find(([, cell]) => cell.code === '500')
    return c ? [`${op} (${c[0]}): ${c[1].message ?? ''}`] : []
  })
  section('Ответ 500 на чужие аргументы', crashes)
  const invalid = Object.entries(matrix).filter(([, row]) => Object.values(row).some(c => c.outcome === 'invalid')).map(([op, row]) => `${op}: ${Object.values(row).find(c => c.outcome === 'invalid')?.message ?? ''}`)
  section('Вызов не прошёл проверку схемы (право не проверено)', invalid)
  if (fs.existsSync(SNAPSHOT))
    section('Расхождение со снимком', snapshotDrift())
  else lines.push('_Снимка прав ещё нет: кандидат — snapshot.candidate.json в артефактах прогона._', '')
  fs.writeFileSync(path.join(OUT, 'summary.md'), `${lines.join('\n')}\n`)
}
