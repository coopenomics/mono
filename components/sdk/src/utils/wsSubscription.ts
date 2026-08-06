import { createClient, type Client as GraphqlWsClient } from 'graphql-ws'
import {
  type GraphQLTypes,
  type InputType,
  type OperationOptions,
  type ValueTypes,
  Zeus,
} from '../zeus/index'

/**
 * Собственный ws-путь GraphQL-подписок поверх документ-билдера и типов Zeus.
 *
 * Живёт в НЕгенерируемом коде намеренно: сгенерированный graphql-zeus
 * ws-транспорт теряет variables дважды — `SubscriptionThunder` не передаёт
 * `ops.variables` в транспортную функцию, а `apiSubscription` не принимает их
 * в `client.subscribe`. Документ при этом объявляет переменные
 * (`$input: Type!`), поэтому сервер падает на коэрции «переменная не
 * предоставлена» ещё до резолвера — подписка молча не открывается, publish
 * уходит в пустоту. Ручные правки zeus/index.ts стирались каждой регенерацией
 * (инцидент 2026-06-09/10: умерли все realtime-подписки marketplace), поэтому
 * отсюда импортируются только публичные экспорты zeus — регенерация этот
 * модуль сломать не может.
 *
 * Кастомные скаляры в подписках не декодируются — ровно как в Query/Mutation
 * Client'а (Thunder без scalars). Появятся скаляры в событиях — добавить
 * decodeScalarsInResponse по образцу сгенерированного SubscriptionThunder.
 *
 * Reconnect: ограниченный retry + backoff с потолком. Infinity/агрессивный
 * reconnect при мёртвом бэкенде вывешивал вкладку (self-DDoS).
 */

/** Хэндл открытой подписки (честная сигнатура open/error — без кастов у потребителя). */
export interface WsSubscriptionHandle<Z, T> {
  /**
   * Закрывает ТОЛЬКО эту подписку (unsubscribe). Общий graphql-ws client
   * остаётся жить для других операций; при lazy-режиме сокет сам гаснет,
   * когда активных подписок не осталось.
   */
  ws: { close: () => void }
  /** Очередное событие подписки (payload data). */
  on: (fn: (args: InputType<T, Z, Record<string, never>>) => void) => void
  /** Ошибка операции или транспорта (реконнект graphql-ws отрабатывает сам). */
  error: (fn: (e: unknown) => void) => void
  /** Сокет (пере)открыт — момент для catch-up дочитки пропущенного. */
  open: (listener: () => void) => void
  /** Операция завершена сервером. */
  off: (fn: () => void) => void
}

export type WsHeadersProvider = HeadersInit | (() => HeadersInit)

export interface WsSubscriptionOptions {
  headers?: WsHeadersProvider
}

const KEEP_ALIVE_MS = 15_000
/** Хватает на типичный рестарт controller; дальше — тишина до ручного reopen. */
const RETRY_ATTEMPTS = 8
const RETRY_BASE_MS = 1_000
const RETRY_MAX_MS = 30_000

function resolveHeaders(headers?: WsHeadersProvider): HeadersInit {
  if (!headers) return {}
  return typeof headers === 'function' ? headers() : headers
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Фабрика subscription-API на одном shared graphql-ws client.
 * Вызывать один раз на экземпляр SDK Client и кэшировать результат.
 */
export function wsSubscription(url: string, options: WsSubscriptionOptions = {}) {
  let disposed = false
  let client: GraphqlWsClient | null = null

  const getClient = (): GraphqlWsClient => {
    if (disposed) {
      throw new Error('wsSubscription: client disposed')
    }
    if (!client) {
      client = createClient({
        url,
        // Функция — чтобы Authorization подхватывался на каждом (ре)коннекте,
        // а не замораживался снимком headers на момент создания.
        connectionParams: () =>
          Object.fromEntries(new Headers(resolveHeaders(options.headers)).entries()),
        keepAlive: KEEP_ALIVE_MS,
        retryAttempts: RETRY_ATTEMPTS,
        retryWait: async (retries) => {
          const delay = Math.min(RETRY_BASE_MS * 2 ** retries, RETRY_MAX_MS)
          const jitter = Math.floor(Math.random() * 1_000)
          await new Promise((resolve) => setTimeout(resolve, delay + jitter))
        },
        shouldRetry: (errOrCloseEvent) => {
          // Офлайн / вкладка без сети — не долбим сами себя.
          if (isBrowserOffline()) return false
          // Как дефолт graphql-ws: ретраим только close-подобные события.
          return (
            typeof errOrCloseEvent === 'object' &&
            errOrCloseEvent !== null &&
            'code' in errOrCloseEvent
          )
        },
      })
    }
    return client
  }

  const dispose = (): void => {
    disposed = true
    if (client) {
      client.dispose()
      client = null
    }
  }

  // По ws ходят только subscription-операции (query/mutation — HTTP Thunder).
  const api = (operation: 'subscription') =>
    <Z extends ValueTypes['Subscription']>(
      o: Z & { [P in keyof Z]: P extends keyof ValueTypes['Subscription'] ? Z[P] : never },
      ops?: OperationOptions & { variables?: Record<string, unknown> },
    ): WsSubscriptionHandle<Z, GraphQLTypes['Subscription']> => {
      let onMessage: ((args: any) => void) | undefined
      let onError: ((e: unknown) => void) | undefined
      let onClose: (() => void) | undefined
      let removeOpened: (() => void) | undefined

      const wsClient = getClient()
      const unsubscribe = wsClient.subscribe(
        {
          query: Zeus(operation, o, { operationOptions: ops }),
          variables: ops?.variables,
        },
        {
          next({ data }) {
            onMessage?.(data)
          },
          error(error) {
            onError?.(error)
          },
          complete() {
            onClose?.()
          },
        },
      )

      return {
        ws: {
          close: () => {
            removeOpened?.()
            removeOpened = undefined
            unsubscribe()
          },
        },
        on(listener) {
          onMessage = listener
        },
        error(listener) {
          onError = listener
        },
        open(listener) {
          removeOpened?.()
          removeOpened = wsClient.on('opened', listener)
        },
        off(listener) {
          onClose = listener
        },
      }
    }

  return Object.assign(api, { dispose })
}

export type WsSubscriptionApi = ReturnType<typeof wsSubscription>
