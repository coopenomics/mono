// Адрес каталога приложений для команд набора издателя на компьютере
// разработчика (487-37): стол подставляет его в команды инструкции.
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

/** Адрес каталога; `null` — адрес узлу не задан. */
async function publicCatalogUrl(): Promise<string | null> {
  const { [Queries.Extensions.AppsCatalogPublicUrl.name]: output } = await client.Query(
    Queries.Extensions.AppsCatalogPublicUrl.query,
    { variables: {} },
  );
  return output ?? null;
}

export const api = { publicCatalogUrl };
