import type { Kysely } from 'kysely';
import type { TableStore } from '@coopenomics/extension-kit';
import { marketplaceStoreProviders } from '~/extensions/marketplace/infrastructure/database/marketplace-stores';

/**
 * Настоящий шлюз таблицы Стола заказов поверх тестового Kysely — с теми же
 * настройками (ключ, json-колонки, числа), что и в работе.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function marketplaceStore<TRecord extends object>(token: symbol, db: Kysely<any>): TableStore<TRecord> {
  const provider = marketplaceStoreProviders.find((candidate) => (candidate as { provide: symbol }).provide === token);
  if (!provider) throw new Error(`Marketplace store is not declared: ${String(token)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (provider as { useFactory: (db: Kysely<any>) => TableStore<TRecord> }).useFactory(db);
}
