/**
 * База CoopID (`coop_domain_db`): настройки входа, второй фактор, правила
 * доступа, журнал аудита. Запросы — готовым SQL с нумерованными параметрами;
 * значения передаются только параметрами.
 */
export interface ICoopDomainDatabase {
  /**
   * Строки ответа. У записи с `RETURNING` это затронутые строки — их число и
   * есть число изменённых записей.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<TRow = any>(text: string, parameters?: readonly unknown[]): Promise<TRow[]>;
}

export const COOP_DOMAIN_DATABASE = Symbol('COOP_DOMAIN_DATABASE');
