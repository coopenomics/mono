import type { Queries, Zeus } from '@coopenomics/sdk';

export type ITimeEntriesPagination =
  Queries.Capital.GetTimeEntries.IOutput[typeof Queries.Capital.GetTimeEntries.name];

export type ITimeEntry = Queries.Capital.GetTimeEntries.IOutput[typeof Queries.Capital.GetTimeEntries.name]['items'][0];

export type IGetTimeEntriesInput = Queries.Capital.GetTimeEntries.IInput;

/** Открытая (незавершённая) сессия таймера участника — одна на пользователя */
export type ITimerSession = Zeus.ModelTypes['CapitalTimerSession'];
