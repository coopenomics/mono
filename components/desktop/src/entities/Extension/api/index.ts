import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
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

async function subscribePackage(
  data: Mutations.Extensions.SubscribePackage.IInput['data'],
): Promise<Mutations.Extensions.SubscribePackage.IOutput[typeof Mutations.Extensions.SubscribePackage.name]> {
  const { [Mutations.Extensions.SubscribePackage.name]: output } = await client.Mutation(
    Mutations.Extensions.SubscribePackage.mutation,
    {
      variables: {
        data,
      },
    },
  );
  return output;
}

async function loadPendingModerations(
  status?: Queries.Extensions.AppsCatalogPendingModerations.IInput['status'],
): Promise<Queries.Extensions.AppsCatalogPendingModerations.IOutput[typeof Queries.Extensions.AppsCatalogPendingModerations.name]> {
  const { [Queries.Extensions.AppsCatalogPendingModerations.name]: output } = await client.Query(
    Queries.Extensions.AppsCatalogPendingModerations.query,
    {
      variables: {
        status,
      },
    },
  );
  return output;
}

async function approveModeration(
  data: Mutations.Extensions.ApproveModeration.IInput['data'],
): Promise<Mutations.Extensions.ApproveModeration.IOutput[typeof Mutations.Extensions.ApproveModeration.name]> {
  const { [Mutations.Extensions.ApproveModeration.name]: output } = await client.Mutation(
    Mutations.Extensions.ApproveModeration.mutation,
    {
      variables: {
        data,
      },
    },
  );
  return output;
}

async function rejectModeration(
  data: Mutations.Extensions.RejectModeration.IInput['data'],
): Promise<Mutations.Extensions.RejectModeration.IOutput[typeof Mutations.Extensions.RejectModeration.name]> {
  const { [Mutations.Extensions.RejectModeration.name]: output } = await client.Mutation(
    Mutations.Extensions.RejectModeration.mutation,
    {
      variables: {
        data,
      },
    },
  );
  return output;
}

async function unsubscribePackage(
  data: Mutations.Extensions.UnsubscribePackage.IInput['data'],
): Promise<Mutations.Extensions.UnsubscribePackage.IOutput[typeof Mutations.Extensions.UnsubscribePackage.name]> {
  const { [Mutations.Extensions.UnsubscribePackage.name]: output } = await client.Mutation(
    Mutations.Extensions.UnsubscribePackage.mutation,
    { variables: { data } },
  );
  return output;
}

async function setCatalogAppEnabled(
  data: Mutations.Extensions.SetCatalogAppEnabled.IInput['data'],
): Promise<boolean> {
  const { [Mutations.Extensions.SetCatalogAppEnabled.name]: output } = await client.Mutation(
    Mutations.Extensions.SetCatalogAppEnabled.mutation,
    { variables: { data } },
  );
  return output;
}

/** Права ядра приложения каталога на узле: что просит версия, что разрешено, что ждёт согласия. */
async function loadCatalogAppRights(
  packageId: string,
): Promise<Queries.Extensions.CatalogAppRights.IOutput[typeof Queries.Extensions.CatalogAppRights.name]> {
  const { [Queries.Extensions.CatalogAppRights.name]: output } = await client.Query(
    Queries.Extensions.CatalogAppRights.query,
    { variables: { packageId } },
  );
  return output;
}

/** Согласие председателя на права ядра приложения. */
async function grantCatalogAppRights(
  data: Mutations.Extensions.GrantCatalogAppRights.IInput['data'],
): Promise<Mutations.Extensions.GrantCatalogAppRights.IOutput[typeof Mutations.Extensions.GrantCatalogAppRights.name]> {
  const { [Mutations.Extensions.GrantCatalogAppRights.name]: output } = await client.Mutation(
    Mutations.Extensions.GrantCatalogAppRights.mutation,
    { variables: { data } },
  );
  return output;
}

/** Переключатель «Принимать новые права после одобрения модератора каталога». */
async function setCatalogAppRightsAutoAccept(
  data: Mutations.Extensions.SetCatalogAppRightsAutoAccept.IInput['data'],
): Promise<Mutations.Extensions.SetCatalogAppRightsAutoAccept.IOutput[typeof Mutations.Extensions.SetCatalogAppRightsAutoAccept.name]> {
  const { [Mutations.Extensions.SetCatalogAppRightsAutoAccept.name]: output } = await client.Mutation(
    Mutations.Extensions.SetCatalogAppRightsAutoAccept.mutation,
    { variables: { data } },
  );
  return output;
}

async function loadAppsNodeBilling(): Promise<Queries.Extensions.AppsNodeBilling.IOutput[typeof Queries.Extensions.AppsNodeBilling.name]> {
  const { [Queries.Extensions.AppsNodeBilling.name]: output } = await client.Query(
    Queries.Extensions.AppsNodeBilling.query,
    { variables: {} },
  );
  return output;
}

export const api ={
  loadExtensions,
  loadExtensionLogs,
  loadAppsCatalogRemotePackages,
  subscribePackage,
  unsubscribePackage,
  setCatalogAppEnabled,
  loadCatalogAppRights,
  grantCatalogAppRights,
  setCatalogAppRightsAutoAccept,
  loadAppsNodeBilling,
  loadPendingModerations,
  approveModeration,
  rejectModeration
}
