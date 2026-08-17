import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type { INodeSyncState, ISystemInfo } from '../types';

async function loadSystemInfo(): Promise<ISystemInfo> {
  const { [Queries.System.GetSystemInfo.name]: output } = await client.Query(Queries.System.GetSystemInfo.query);
  return output;
}

/** Пусто, пока узел не измерил своё состояние ни разу — это не «всё хорошо». */
async function loadNodeSyncState(): Promise<INodeSyncState | null> {
  const { [Queries.System.GetNodeSyncState.name]: output } = await client.Query(
    Queries.System.GetNodeSyncState.query,
  );
  return output ?? null;
}

export const api ={
  loadSystemInfo,
  loadNodeSyncState
}
