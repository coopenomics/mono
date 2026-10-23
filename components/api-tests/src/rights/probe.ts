/**
 * Проба прав одной операции снаружи: вызов строится по схеме сервера, как в
 * матрице прав, подменяются только названные поля запроса (имя пайщика).
 * Отвечает на один вопрос — отказал ли гард прав и каким кодом.
 */
import { gqlError, waitFor } from '../core'
import type { Operation } from './schema'
import { SchemaModel } from './schema'

export const NO_RIGHT = 'KIT_INSUFFICIENT_RIGHTS'
export const NOT_OWN = 'KIT_RIGHT_SCOPE_OWN'

const THROTTLED = new Set(['429', 'GRAPHQL_RATE_LIMITED', 'THROTTLED'])

/** Записать значение по пути `data.username` в переменные запроса. */
function assign(target: Record<string, any>, path: string, value: unknown): void {
  const keys = path.split('.')
  let node = target
  for (const key of keys.slice(0, -1))
    node = (node[key] ??= {})
  node[keys[keys.length - 1]] = value
}

export interface RightsProbe {
  /**
   * Код отказа прав операции `name`, вызванной с подменёнными полями `set`
   * (путь → значение); null — гард прав пропустил.
   */
  denial: (token: string, name: string, set?: Record<string, unknown>) => Promise<string | null>
}

export async function loadRightsProbe(schemaToken: string): Promise<RightsProbe> {
  const operations = new Map<string, Operation>((await SchemaModel.load(schemaToken)).operations().map(o => [o.name, o]))
  return {
    async denial(token, name, set = {}) {
      const op = operations.get(name)
      if (!op)
        throw new Error(`операции ${name} нет в схеме`)
      const variables = structuredClone(op.variables) as Record<string, any>
      for (const [path, value] of Object.entries(set))
        assign(variables, path, value)
      // Документы ограничены по частоте запросов: на отказ частоты вызов
      // повторяется, пока сервер не дойдёт до проверки прав.
      const code = await waitFor(async () => {
        const err = await gqlError(token, op.document, variables)
        const got = String(err?.code ?? '')
        return err?.httpStatus === 429 || THROTTLED.has(got) ? null : got
      }, { timeoutMs: 90_000, intervalMs: 5_000, label: `ответ ${name} без ограничения частоты` })
      return code === NO_RIGHT || code.startsWith('KIT_RIGHT_SCOPE_') ? code : null
    },
  }
}
