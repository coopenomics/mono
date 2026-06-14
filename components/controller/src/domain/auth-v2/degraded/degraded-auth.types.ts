/**
 * Причина перехода входа CoopID в degraded-режим (Story 4.5). Используется в
 * audit `coopid.auth.degraded` и в ответе verify-timestamp.
 */
export enum DegradedAuthReason {
  /**
   * Живой узел COOPOS недоступен (RPC down): ключ сверен против свежего снимка
   * `chain_manifests_cache`, а не против живого аккаунта. Единственный триггер
   * degraded на login-пути.
   */
  RpcUnavailable = 'rpc_unavailable',
  /**
   * Активный ключ присутствует в head-состоянии COOPOS, но смена ключа ещё не
   * финализирована (last_updated новее границы LIB) — её может откатить chain
   * reorg. Story 9.6 (finalized-only reads): живому head-снимку не доверяем,
   * сверяем ключ против последнего финализированного снимка `chain_manifests_cache`
   * и помечаем вход degraded. До 9.6 на login-пути не триггерило.
   */
  KeyNotFinalized = 'key_not_finalized',
}
