import type { Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import type { TableStore } from '@coopenomics/extension-kit';

/**
 * Настоящий шлюз таблицы расширения поверх тестового Kysely — с теми же
 * настройками (ключ, json-колонки, числа, имена колонок), что и в работе.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function storeFrom<TRecord extends object>(providers: Provider[], token: symbol, db: Kysely<any>): TableStore<TRecord> {
  const provider = providers.find((candidate) => (candidate as { provide: symbol }).provide === token);
  if (!provider) throw new Error(`Table store is not declared: ${String(token)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (provider as { useFactory: (db: Kysely<any>) => TableStore<TRecord> }).useFactory(db);
}
