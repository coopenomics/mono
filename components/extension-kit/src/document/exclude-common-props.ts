/**
 * Убрать из формы документа поля, которые проставляет реестр, а не заявитель.
 *
 * `coopname`, `username` и `registry_id` есть у каждого документа и приходят из
 * контекста запроса, поэтому в специфичной части формы они лишние.
 */
export type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;
