import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';
import type {
  IGetTimeEntriesInput,
  ITimeEntriesPagination,
} from '../model/types';

export type IAddWorklogInput = Mutations.Capital.AddWorklog.IInput['data'];
export type IStartTimerInput = Mutations.Capital.StartTimer.IInput['data'];
export type IStopTimerInput = Mutations.Capital.StopTimer.IInput['data'];
export type IPauseTimerInput = Mutations.Capital.PauseTimer.IInput['data'];
export type IResumeTimerInput = Mutations.Capital.ResumeTimer.IInput['data'];
export type IGetOpenTimerInput = Queries.Capital.GetOpenTimer.IInput['data'];

async function loadTimeEntries(
  data: IGetTimeEntriesInput,
): Promise<ITimeEntriesPagination> {
  const { [Queries.Capital.GetTimeEntries.name]: output } = await client.Query(
    Queries.Capital.GetTimeEntries.query,
    {
      variables: data,
    },
  );
  return output;
}

async function addWorklog(data: IAddWorklogInput) {
  const { [Mutations.Capital.AddWorklog.name]: output } = await client.Mutation(
    Mutations.Capital.AddWorklog.mutation,
    { variables: { data } },
  );
  return output;
}

async function startTimer(data: IStartTimerInput) {
  const { [Mutations.Capital.StartTimer.name]: output } = await client.Mutation(
    Mutations.Capital.StartTimer.mutation,
    { variables: { data } },
  );
  return output;
}

async function stopTimer(data: IStopTimerInput) {
  const { [Mutations.Capital.StopTimer.name]: output } = await client.Mutation(
    Mutations.Capital.StopTimer.mutation,
    { variables: { data } },
  );
  return output;
}

async function pauseTimer(data: IPauseTimerInput) {
  const { [Mutations.Capital.PauseTimer.name]: output } = await client.Mutation(
    Mutations.Capital.PauseTimer.mutation,
    { variables: { data } },
  );
  return output;
}

async function resumeTimer(data: IResumeTimerInput) {
  const { [Mutations.Capital.ResumeTimer.name]: output } = await client.Mutation(
    Mutations.Capital.ResumeTimer.mutation,
    { variables: { data } },
  );
  return output;
}

async function getOpenTimer(data: IGetOpenTimerInput) {
  const { [Queries.Capital.GetOpenTimer.name]: output } = await client.Query(
    Queries.Capital.GetOpenTimer.query,
    { variables: { data } },
  );
  return output;
}

export const api = {
  loadTimeEntries,
  addWorklog,
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
  getOpenTimer,
};
