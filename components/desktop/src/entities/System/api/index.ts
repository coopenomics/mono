import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type { INodeSyncState, ISystemInfo } from '../types';

async function loadSystemInfo(): Promise<ISystemInfo> {
  const { [Queries.System.GetSystemInfo.name]: output } = await client.Query(Queries.System.GetSystemInfo.query);
  return output;
}

async function loadNodeSyncState(): Promise<INodeSyncState> {
  const { [Queries.System.GetNodeSyncState.name]: output } = await client.Query(
    Queries.System.GetNodeSyncState.query,
  );
  return output;
}

export const api ={
  loadSystemInfo,
  loadNodeSyncState
}
