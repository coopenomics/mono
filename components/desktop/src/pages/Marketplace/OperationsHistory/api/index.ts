import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type ProcessSummaryView =
  Queries.Processes.ListProcesses.IOutput['processes']['items'][number];

export type ProcessesPageView = Queries.Processes.ListProcesses.IOutput['processes'];

export type ProcessView = Queries.Processes.GetProcess.IOutput['process'];

export type IProcessesFilterInput = Queries.Processes.ListProcesses.IInput['filter'];

export type IPaginationInput = Queries.Processes.ListProcesses.IInput['pagination'];

export async function listProcesses(
  filter: IProcessesFilterInput,
  pagination: IPaginationInput,
): Promise<ProcessesPageView> {
  const { [Queries.Processes.ListProcesses.name]: result } = await client.Query(
    Queries.Processes.ListProcesses.query,
    { variables: { filter, pagination } },
  );
  return result;
}

export async function getProcess(coopname: string, hash: string): Promise<ProcessView> {
  const { [Queries.Processes.GetProcess.name]: result } = await client.Query(
    Queries.Processes.GetProcess.query,
    { variables: { coopname, hash } },
  );
  return result;
}
