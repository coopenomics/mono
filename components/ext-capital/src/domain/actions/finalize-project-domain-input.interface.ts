/**
 * Входные данные для финализации проекта
 * Финализация проекта после завершения всех конвертаций участников
 */
export interface IFinalizeProjectDomainInput {
  /** Имя кооператива */
  coopname: string;

  /** Хеш проекта для финализации */
  project_hash: string;
}
