/**
 * Помощники внешних тестов платформы (набор platform-b): обход схемы в поисках
 * списков с полем сортировки, признаки утечки SQL в ответе, сбор вызова с
 * валидными по схеме аргументами.
 *
 * Список с сортировкой ищется по схеме стенда, а не по перечню в тесте: новый
 * список с PaginationInput попадает под проверку сам, без правки теста.
 */
import type { Who } from '../core/auth'
import { tokenOf } from '../core/auth'
import { gql, gqlRaw } from '../core/client'
import type { GqlResponse } from '../core/client'
import { API_URL, COOP } from '../core/env'
import { bankAccount } from '../payments/payments.helpers'
import { INTROSPECTION, named, printType, type FullType, type TypeRef } from '../rights/schema'

/** Список, у которого клиент задаёт поле сортировки. */
export interface SortableList {
  /** Имя запроса схемы. */
  query: string
  /** Где лежит поле сортировки: `options.sortBy`, `data.pagination.sortBy`. */
  where: string
  /** Вход — общий PaginationInput (а не собственный вход списка). */
  paginationInput: boolean
  /** Документ и переменные вызова с заданной сортировкой (undefined — поле не передаётся). */
  call: (caller: string, sortBy?: string, sortOrder?: string) => { document: string, variables: Record<string, unknown> }
}

const ZERO_HASH = '0'.repeat(64)

class Schema {
  readonly types = new Map<string, FullType>()
  queryType = 'Query'

  constructor(d: any) {
    this.queryType = d.__schema.queryType?.name ?? 'Query'
    for (const t of d.__schema.types as FullType[]) this.types.set(t.name, t)
  }

  input(name: string | null): FullType | undefined {
    const t = name ? this.types.get(name) : undefined
    return t?.kind === 'INPUT_OBJECT' ? t : undefined
  }

  hasSortBy(name: string | null): boolean {
    return !!this.input(name)?.inputFields?.some(f => f.name === 'sortBy')
  }

  /** Значение обязательного входа по имени поля; необязательные опускаются. */
  value(t: TypeRef, field: string, caller: string, depth = 0): unknown {
    if (t.kind === 'NON_NULL')
      return this.value(t.ofType!, field, caller, depth)
    if (t.kind === 'LIST')
      return []
    const full = this.types.get(t.name!)
    if (t.kind === 'ENUM')
      return full?.enumValues?.[0]?.name ?? null
    if (t.kind === 'INPUT_OBJECT') {
      const out: Record<string, unknown> = {}
      if (depth > 6)
        return out
      for (const f of full?.inputFields ?? []) {
        if (f.type.kind === 'NON_NULL')
          out[f.name] = this.value(f.type, f.name, caller, depth + 1)
      }
      return out
    }
    switch (t.name) {
      case 'Int':
      case 'Float': return 1
      case 'Boolean': return false
      case 'DateTime': return '2026-01-01T00:00:00.000Z'
      case 'JSON':
      case 'JSONObject': return {}
    }
    const f = field.toLowerCase()
    if (f === 'coopname')
      return COOP
    if (f === 'braname')
      return 'krg'
    if (f.includes('hash'))
      return ZERO_HASH
    if (f === 'username' || f.endsWith('_username') || f.endsWith('account'))
      return caller
    return 'x'
  }

  /** Вход с полем сортировки: обязательные поля + страница + сортировка. */
  sortInput(typeName: string, caller: string, sortBy?: string, sortOrder?: string): Record<string, unknown> {
    const full = this.input(typeName)!
    const out = this.value({ kind: 'INPUT_OBJECT', name: typeName, ofType: null }, '', caller) as Record<string, unknown>
    const has = (n: string) => full.inputFields!.some(f => f.name === n)
    if (has('page'))
      out.page = 1
    if (has('limit'))
      out.limit = 5
    if (has('sortOrder'))
      out.sortOrder = sortOrder ?? 'DESC'
    if (sortBy !== undefined)
      out.sortBy = sortBy
    else
      delete out.sortBy
    return out
  }

  sortableLists(): SortableList[] {
    const out: SortableList[] = []
    const query = this.types.get(this.queryType)!
    for (const f of query.fields ?? []) {
      for (const arg of f.args) {
        const argType = named(arg.type)
        let path: string[] | null = null
        let sortType: string | null = null
        if (this.hasSortBy(argType.name)) {
          path = [arg.name]
          sortType = argType.name
        }
        else {
          for (const inner of this.input(argType.name)?.inputFields ?? []) {
            const it = named(inner.type)
            if (this.hasSortBy(it.name)) {
              path = [arg.name, inner.name]
              sortType = it.name
              break
            }
          }
        }
        if (!path || !sortType)
          continue
        const ret = named(f.type)
        const retKind = this.types.get(ret.name!)?.kind ?? ret.kind
        const selection = ['OBJECT', 'INTERFACE', 'UNION'].includes(retKind) ? ' { __typename }' : ''
        const used = f.args.filter(a => a.type.kind === 'NON_NULL' || a.name === path![0])
        const decl = used.map(a => `$${a.name}: ${printType(a.type)}`).join(', ')
        const callArgs = used.map(a => `${a.name}: $${a.name}`).join(', ')
        const document = `query SortProbe(${decl}) { ${f.name}(${callArgs})${selection} }`
        const p = path
        const st = sortType
        out.push({
          query: f.name,
          where: `${p.join('.')}.sortBy`,
          paginationInput: st === 'PaginationInput',
          call: (caller, sortBy, sortOrder) => {
            const variables: Record<string, unknown> = {}
            for (const a of used) {
              if (a.name !== p[0])
                variables[a.name] = this.value(a.type, a.name, caller)
            }
            const sort = this.sortInput(st, caller, sortBy, sortOrder)
            if (p.length === 1) {
              variables[p[0]] = sort
            }
            else {
              const outer = this.value(used.find(a => a.name === p[0])!.type, p[0], caller) as Record<string, unknown> ?? {}
              variables[p[0]] = { ...outer, [p[1]]: sort }
            }
            return { document, variables }
          },
        })
        break
      }
    }
    return out
  }
}

let schemaPromise: Promise<Schema> | null = null

/** Схема стенда (интроспекция один раз на прогон). */
export async function loadSchema(token: string): Promise<Schema> {
  schemaPromise ??= gql<any>(token, INTROSPECTION).then(d => new Schema(d))
  return schemaPromise
}

/** Все запросы схемы, где клиент задаёт поле сортировки. */
export async function sortableLists(token: string): Promise<SortableList[]> {
  return (await loadSchema(token)).sortableLists()
}

/**
 * Признаки того, что строка клиента дошла до SQL: ошибка разбора, ссылка на
 * несуществующую колонку или таблицу, текст драйвера. Отказ проверки ввода их
 * не содержит — он говорит о поле, а не о запросе.
 */
export const SQL_LEAK = /syntax error|does not exist|QueryFailedError|unterminated|division by zero|pbsortprobe|relation "|column "/i

/** Ответ на вызов списка от лица участника. */
export async function callList(who: Who, list: SortableList, sortBy?: string, sortOrder?: string): Promise<GqlResponse<any>> {
  const { document, variables } = list.call(who.account, sortBy, sortOrder)
  return gqlRaw(await tokenOf(who), document, variables)
}

/** Код отказа строкой: у отказа проверки ввода он числом (422). */
export function codeOf(r: GqlResponse<any>): string | null {
  const c = r.errors[0]?.code
  return c === null || c === undefined ? null : String(c)
}

// ── Анкеты вступления ───────────────────────────────────────────────────────

/** Ключ под анкету: регистрации нужен только публичный. */
export async function freshKeyPair(): Promise<{ wif: string, publicKey: string }> {
  const ecc = (await import('eosjs-ecc')).default
  const wif = ecc.seedPrivate(`platform-b-${Date.now()}-${Math.random()}`)
  return { wif, publicKey: ecc.privateToPublic(wif) }
}


/**
 * Анкета физлица с привычными знаками: дефис в фамилии, апостроф в имени,
 * дробь и номер в адресе. Такие данные сервер обязан принять.
 */
export function individualData(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    first_name: 'Д\'Артаньян',
    last_name: 'Петрова-Водкина',
    middle_name: 'Сергеевна',
    birthdate: '1990/01/01',
    phone: '+7 (900) 000-00-00',
    full_address: 'г. Москва, ул. Садовая-Кудринская, д. 5/2, кв. 7 (вход со двора) №3',
    passport: { series: 4510, number: 123456, issued_by: 'ОВД «Тверской» г. Москвы', issued_at: '2010/01/01', code: '770-001' },
    ...overrides,
  }
}

export function entrepreneurData(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    first_name: 'Иван',
    last_name: 'Римский-Корсаков',
    middle_name: 'Петрович',
    birthdate: '1985/05/05',
    phone: '+7 (901) 111-22-33',
    city: 'Санкт-Петербург',
    country: 'Russia',
    full_address: 'г. Санкт-Петербург, наб. реки Мойки, д. 12/1, лит. А',
    details: { inn: '780000000001', ogrn: '304780000000001' },
    bank_account: bankAccount(),
    ...overrides,
  }
}

export function organizationData(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    short_name: 'ПК «Сад-Огород»',
    full_name: 'Потребительский кооператив «Сад-Огород» (ПК \'СО\')',
    type: 'COOP',
    phone: '+7 (901) 123-45-67',
    country: 'Россия',
    city: 'Москва',
    full_address: 'г. Москва, ул. Тестовая, д. 1/3, оф. 100',
    fact_address: 'г. Москва, ул. Тестовая, д. 1/3, оф. 100',
    details: { inn: '7700000001', ogrn: '1027700000001', kpp: '770001001' },
    represented_by: {
      first_name: 'Иван',
      last_name: 'Иванов',
      middle_name: 'Иванович',
      based_on: 'решения общего собрания № 1 от 01.01.2026 г.',
      position: 'Председатель совета',
    },
    bank_account: bankAccount(),
    ...overrides,
  }
}

export const REGISTER_ACCOUNT = `mutation($d:RegisterAccountInput!){
  registerAccount(data:$d){ account{ username } }
}`

export type AccountKind = 'individual' | 'entrepreneur' | 'organization'

/** Вход регистрации аккаунта с анкетой нужного вида. */
export function registerInput(username: string, publicKey: string, kind: AccountKind, data: Record<string, unknown>): Record<string, unknown> {
  return {
    username,
    email: `${username}@api-tests.coop`,
    public_key: publicKey,
    type: kind,
    [`${kind}_data`]: data,
  }
}

// ── Ответ сервера целиком ───────────────────────────────────────────────────

/** Ошибка GraphQL как есть: текст и все extensions (code, status, params). */
export interface RawGqlError { message: string, extensions: Record<string, any> }

/**
 * Вызов GraphQL с произвольными заголовками (язык запроса) и ответом целиком:
 * общему клиенту ядра нужны только код и текст, здесь проверяются ещё статус
 * и параметры отказа.
 */
export async function gqlFull(token: string | null, query: string, variables?: unknown, headers: Record<string, string> = {}): Promise<{ status: number, data: any, errors: RawGqlError[] }> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...headers }
  if (token)
    h.Authorization = `Bearer ${token}`
  const res = await fetch(API_URL, { method: 'POST', headers: h, body: JSON.stringify({ query, variables }) })
  const payload: any = await res.json()
  return {
    status: res.status,
    data: payload.data ?? null,
    errors: (payload.errors ?? []).map((e: any) => ({ message: String(e?.message ?? ''), extensions: e?.extensions ?? {} })),
  }
}

/** Корень сервера (без /v1/graphql) — для REST-маршрутов. */
export async function apiOrigin(): Promise<string> {
  return new URL(API_URL).origin
}

export { bankAccount }
