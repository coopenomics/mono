/**
 * Доменный интерфейс для действия установки плана проекта CAPITAL контракта
 */
export interface SetPlanDomainInput {
  /** Имя аккаунта кооператива */
  coopname: string;

  /** Имя мастера проекта */
  master: string;

  /** Хэш проекта */
  project_hash: string;

  /** Плановое количество часов создателей */
  plan_creators_hours: number;

  /** Плановые расходы */
  plan_expenses: string;

  /** Стоимость часа работы */
  plan_hour_cost: string;
}
