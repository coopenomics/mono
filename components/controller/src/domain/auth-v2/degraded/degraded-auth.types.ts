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
   * Ключ присутствует в head-состоянии, но ещё не в финализированном блоке.
   * Зарезервировано: на login-пути НЕ триггерит (если живой узел отвергает ключ —
   * это честный key_mismatch). Относится к записи не-финализированного ключа
   * (recovery-ротация Story 3.3 / cert-issuance Story 1.8).
   */
  KeyNotFinalized = 'key_not_finalized',
}
