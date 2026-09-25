/**
 * Операции схемы и валидные по схеме аргументы к ним.
 *
 * Проверка схемы (обязательные аргументы, типы переменных) идёт раньше
 * проверок прав и прятала бы их решение, поэтому каждый вызов собирается
 * валидным: обязательные аргументы заполнены значениями нужного типа,
 * необязательные опущены. Значения заведомо чужие — несуществующий пайщик,
 * нулевой хэш: вызов проверяет, пускают ли роль, а не делает дело.
 * Собственное имя вызывающего не подставляется никогда — иначе сработал бы
 * обход «сам себе» и роль бы не проверялась.
 */
import { gql } from '../core/client'
import { COOP } from '../core/env'

export interface TypeRef { kind: string, name: string | null, ofType: TypeRef | null }
export interface InputValue { name: string, type: TypeRef }
export interface FullType {
  kind: string
  name: string
  fields: { name: string, args: InputValue[], type: TypeRef }[] | null
  inputFields: InputValue[] | null
  enumValues: { name: string }[] | null
}

export const TYPE_REF = 'kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }'
export const INTROSPECTION = `{ __schema {
  queryType { name } mutationType { name } subscriptionType { name }
  types { kind name
    fields(includeDeprecated: true) { name args { name type { ${TYPE_REF} } } type { ${TYPE_REF} } }
    inputFields { name type { ${TYPE_REF} } }
    enumValues(includeDeprecated: true) { name }
  }
} }`

export interface Operation {
  kind: 'query' | 'mutation'
  name: string
  /** Документ запроса и переменные — валидные по схеме. */
  document: string
  variables: Record<string, unknown>
  /** Аргумент загрузки файла — такие операции матрица не зовёт. */
  hasUpload: boolean
}

/** Несуществующий пайщик: не совпадает ни с кем на стенде. */
export const PROBE_ACCOUNT = 'rightsprobe1'
const ZERO_HASH = '0'.repeat(64)

export function printType(t: TypeRef): string {
  if (t.kind === 'NON_NULL')
    return `${printType(t.ofType!)}!`
  if (t.kind === 'LIST')
    return `[${printType(t.ofType!)}]`
  return t.name!
}

export function named(t: TypeRef): TypeRef {
  let x = t
  while (x.ofType) x = x.ofType
  return x
}

function scalarValue(scalar: string, field: string): unknown {
  const f = field.toLowerCase()
  switch (scalar) {
    case 'Int': return 1
    case 'Float': return 1
    case 'Boolean': return false
    case 'ID': return '1'
    case 'DateTime':
    case 'Date': return '2026-01-01T00:00:00.000Z'
    case 'JSON':
    case 'JSONObject': return {}
  }
  if (f === 'coopname')
    return COOP
  if (f.includes('hash'))
    return ZERO_HASH
  if (f.includes('email'))
    return 'rights@probe.coop'
  if (f === 'username' || f.endsWith('_username') || f.endsWith('account') || f === 'member' || f === 'owner' || f === 'contributor')
    return PROBE_ACCOUNT
  if (f === 'braname')
    return 'rightsprobe'
  return 'rightsprobe'
}

export class SchemaModel {
  private readonly types = new Map<string, FullType>()
  queryType = 'Query'
  mutationType = 'Mutation'

  static async load(token: string | null): Promise<SchemaModel> {
    return SchemaModel.fromIntrospection(await gql<any>(token, INTROSPECTION))
  }

  /** Из результата интроспекции `{ __schema }`. */
  static fromIntrospection(d: any): SchemaModel {
    const m = new SchemaModel()
    m.queryType = d.__schema.queryType?.name ?? 'Query'
    m.mutationType = d.__schema.mutationType?.name ?? 'Mutation'
    for (const t of d.__schema.types as FullType[]) m.types.set(t.name, t)
    return m
  }

  private uploadIn(t: TypeRef, seen = new Set<string>()): boolean {
    const n = named(t)
    if (n.name === 'Upload')
      return true
    if (n.kind !== 'INPUT_OBJECT' || seen.has(n.name!))
      return false
    seen.add(n.name!)
    return (this.types.get(n.name!)?.inputFields ?? []).some(f => this.uploadIn(f.type, seen))
  }

  /** Значение обязательного входа; необязательные поля опускаются. */
  private value(t: TypeRef, field: string, depth: number): unknown {
    if (t.kind === 'NON_NULL')
      return this.value(t.ofType!, field, depth)
    if (t.kind === 'LIST')
      return []
    const full = this.types.get(t.name!)
    if (t.kind === 'ENUM')
      return full?.enumValues?.[0]?.name ?? null
    if (t.kind === 'INPUT_OBJECT') {
      if (depth > 8)
        return {}
      const out: Record<string, unknown> = {}
      for (const f of full?.inputFields ?? []) {
        if (f.type.kind === 'NON_NULL')
          out[f.name] = this.value(f.type, f.name, depth + 1)
      }
      return out
    }
    return scalarValue(t.name!, field)
  }

  operations(): Operation[] {
    const out: Operation[] = []
    for (const [kind, typeName] of [['query', this.queryType], ['mutation', this.mutationType]] as const) {
      for (const f of this.types.get(typeName)?.fields ?? []) {
        const required = f.args.filter(a => a.type.kind === 'NON_NULL')
        const decl = required.map(a => `$${a.name}: ${printType(a.type)}`).join(', ')
        const call = required.map(a => `${a.name}: $${a.name}`).join(', ')
        const ret = named(f.type)
        const retKind = this.types.get(ret.name!)?.kind ?? ret.kind
        const selection = ['OBJECT', 'INTERFACE', 'UNION'].includes(retKind) ? ' { __typename }' : ''
        const variables: Record<string, unknown> = {}
        for (const a of required) variables[a.name] = this.value(a.type, a.name, 0)
        out.push({
          kind,
          name: f.name,
          document: `${kind} Rights${decl ? `(${decl})` : ''} { ${f.name}${call ? `(${call})` : ''}${selection} }`,
          variables,
          hasUpload: f.args.some(a => this.uploadIn(a.type)),
        })
      }
    }
    return out
  }
}
