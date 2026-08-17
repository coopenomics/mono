import type { Queries } from '@coopenomics/sdk';

export type ISystemInfo = Queries.System.GetSystemInfo.IOutput[typeof Queries.System.GetSystemInfo.name]

/** Насколько узел кооператива отстал от цепи. */
export type INodeSyncState = Queries.System.GetNodeSyncState.IOutput[typeof Queries.System.GetNodeSyncState.name]
