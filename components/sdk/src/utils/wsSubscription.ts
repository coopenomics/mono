import { createClient } from 'graphql-ws'
import {
  type chainOptions,
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
 */

/** Хэндл открытой подписки (честная сигнатура open/error — без кастов у потребителя). */
export interface WsSubscriptionHandle<Z, T> {
  /** Совместимость с привычкой `stream.ws.close()`: закрывает соединение целиком. */
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

export function wsSubscription(...options: chainOptions) {
  const client = createClient({
    url: String(options[0]),
    connectionParams: Object.fromEntries(new Headers(options[1]?.headers).entries()),
    // Пинг приложения поверх ws: туннели/прокси режут «тихие» соединения,
    // а зомби-сокет без пинга жил бы до 60-сек страховочного resync'а.
    keepAlive: 15_000,
    // Дефолтных 5 попыток не хватает на долгий рестарт dev-бэкенда; 30 с
    // экспоненциальным backoff'ом покрывают часы, не зацикливаясь навечно.
    retryAttempts: 30,
  })

  // По ws ходят только subscription-операции (query/mutation — HTTP Thunder).
  return (operation: 'subscription') =>
    <Z extends ValueTypes['Subscription']>(
      o: Z & { [P in keyof Z]: P extends keyof ValueTypes['Subscription'] ? Z[P] : never },
      ops?: OperationOptions & { variables?: Record<string, unknown> },
    ): WsSubscriptionHandle<Z, GraphQLTypes['Subscription']> => {
      let onMessage: ((args: any) => void) | undefined
      let onError: ((e: unknown) => void) | undefined
      let onClose: (() => void) | undefined

      client.subscribe(
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
        ws: { close: () => client.dispose() },
        on(listener) {
          onMessage = listener
        },
        error(listener) {
          onError = listener
        },
        open(listener) {
          client.on('opened', listener)
        },
        off(listener) {
          onClose = listener
        },
      }
    }
}
