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

export const api ={
  loadExtensions,
  loadExtensionLogs,
  loadAppsCatalogRemotePackages,
  subscribePackage,
  loadPendingModerations,
  approveModeration,
  rejectModeration
}
