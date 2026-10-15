import type { Kysely } from 'kysely';
import type { TableStore } from '@coopenomics/extension-kit';
import { marketplaceStoreProviders } from '~/extensions/marketplace/infrastructure/database/marketplace-stores';
import { storeFrom } from '../../helpers/table-store';

/** Шлюз таблицы Стола заказов поверх тестового Kysely. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function marketplaceStore<TRecord extends object>(token: symbol, db: Kysely<any>): TableStore<TRecord> {
  return storeFrom<TRecord>(marketplaceStoreProviders, token, db);
}
