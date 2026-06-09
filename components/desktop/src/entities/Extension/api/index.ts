import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type { ZExtension } from '../model';

async function loadExtensions(data?: Queries.Extensions.GetExtensions.IInput['data']): Promise<ZExtension[]> {
  const { [Queries.Extensions.GetExtensions.name]: output } = await client.Query(
    Queries.Extensions.GetExtensions.query,
    {
      variables: {
        data
      }
    }
  );
  return output as ZExtension[];
}

async function loadExtensionLogs(data?: Queries.Extensions.GetExtensionLogs.IInput['data'], options?: Queries.Extensions.GetExtensionLogs.IInput['options']): Promise<Queries.Extensions.GetExtensionLogs.IOutput[typeof Queries.Extensions.GetExtensionLogs.name]> {
  const { [Queries.Extensions.GetExtensionLogs.name]: output } = await client.Query(
    Queries.Extensions.GetExtensionLogs.query,
    {
      variables: {
        data,
        options
      }
    }
  );
  return output;
}

async function loadAppsCatalogRemotePackages(
  page = 1,
  pageSize = 50,
): Promise<Queries.Extensions.AppsCatalogRemotePackages.IOutput[typeof Queries.Extensions.AppsCatalogRemotePackages.name]> {
  const { [Queries.Extensions.AppsCatalogRemotePackages.name]: output } = await client.Query(
    Queries.Extensions.AppsCatalogRemotePackages.query,
    {
      variables: {
        page,
        pageSize,
      },
    },
  );
  return output;
}

export const api ={
  loadExtensions,
  loadExtensionLogs,
  loadAppsCatalogRemotePackages
}
