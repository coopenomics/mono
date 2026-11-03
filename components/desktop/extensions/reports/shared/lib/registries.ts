import { ref } from 'vue';
import { Mutations, Queries, type Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { useLedger2Store, type ILedger2HistoryFilterInput, type ILedger2PostingsFilterInput } from 'src/entities/Ledger2';
import { useProcessStore, type IProcessListInput } from 'src/entities/Process';
import { RegistrySource } from 'src/shared/lib/registry-source';

/** Источник реестров стола бухгалтера: его собственные операции под правом стола. */
export const DESK_SOURCE = RegistrySource.ACCOUNTANT;

/** Пайщик в реестрах: учётное имя и имя для показа. */
export interface IDeskParticipant {
  username: string;
  name: string;
}

/** Кошелёк пайщика по программе. */
export interface IDeskParticipantWallet {
  username: string;
  program_id: string;
  available: string;
}

// Имена пайщиков нужны нескольким реестрам подряд: один запрос на вкладку.
let participantsRequest: Promise<IDeskParticipant[]> | null = null;

async function fetchParticipants(): Promise<IDeskParticipant[]> {
  const { [Queries.Reports.ReportsParticipants.name]: rows } = await client.Query(Queries.Reports.ReportsParticipants.query);
  return rows ?? [];
}

/** Принятые пайщики с именами. `fresh` перечитывает список с сервера. */
export function loadDeskParticipants(fresh = false): Promise<IDeskParticipant[]> {
  if (fresh || !participantsRequest) {
    participantsRequest = fetchParticipants().catch((error) => {
      participantsRequest = null;
      throw error;
    });
  }
  return participantsRequest;
}

/** Имена пайщиков по учётному имени — для колонки «Пайщик» в реестрах. */
export async function loadDeskParticipantNames(): Promise<Map<string, string>> {
  return new Map((await loadDeskParticipants()).map((row) => [row.username, row.name]));
}

/** Субъект операции: пайщик, организация, участок или кооператив. */
export interface IDeskSubject {
  username: string;
  name: string;
  account_kind: string;
}

/** Имена и вид субъектов операций по учётным именам. */
export async function loadDeskSubjects(usernames: string[]): Promise<IDeskSubject[]> {
  if (!usernames.length) return [];
  const { [Queries.Reports.ReportsSubjects.name]: rows } = await client.Query(
    Queries.Reports.ReportsSubjects.query,
    { variables: { usernames } },
  );
  return rows ?? [];
}

/**
 * Кеш имён субъектов для реестров стола бухгалтера: в строке приходит учётное
 * имя, показывать нужно имя человека или название. Имена отдаёт операция
 * стола — личные данные пайщиков реестрам не нужны и не запрашиваются.
 */
export function useDeskFioCache() {
  const fioCache = ref(new Map<string, string>());
  const kindCache = ref(new Map<string, string>());

  async function enrichFio(rawUsernames: (string | null | undefined)[]): Promise<void> {
    const usernames = [...new Set(rawUsernames.filter((u): u is string => !!u && !fioCache.value.has(u)))];
    if (!usernames.length) return;
    try {
      for (const subject of await loadDeskSubjects(usernames)) {
        if (subject.account_kind) kindCache.value.set(subject.username, subject.account_kind);
        if (subject.name) fioCache.value.set(subject.username, subject.name);
      }
    } catch {
      // молча — в строке остаётся учётное имя
    }
  }

  return { fioCache, kindCache, enrichFio };
}

/** Кошельки пайщиков по программам кооператива. */
export async function loadDeskParticipantWallets(coopname: string): Promise<IDeskParticipantWallet[]> {
  const { [Queries.Reports.ReportsParticipantWallets.name]: rows } = await client.Query(
    Queries.Reports.ReportsParticipantWallets.query,
    { variables: { coopname } },
  );
  return rows ?? [];
}

/** Фонд кооператива на кошельке учётной книги (страница «Фонды», задача 99D-24). */
export type IDeskFund = Zeus.ModelTypes['ReportsFund'];
/** Реестр фондов с суммой процентов и справкой о вложениях «Благороста». */
export type IDeskFundsRegistry = Zeus.ModelTypes['ReportsFundsRegistry'];
/** Движение по фонду — одна операция учётной книги со знаком относительно фонда. */
export type IDeskFundMovement = Zeus.ModelTypes['ReportsFundMovement'];
export type IDeskFundsInput = Queries.Reports.ReportsFunds.IInput['input'];
export type IDeskFundHistoryInput = Queries.Reports.ReportsFundHistory.IInput['input'];
export type IDeskEditFundInput = Mutations.Reports.ReportsEditFund.IInput['input'];

/** Фонды кооператива с остатками и оборотами за период. */
export async function loadDeskFunds(input: IDeskFundsInput): Promise<IDeskFundsRegistry> {
  const { [Queries.Reports.ReportsFunds.name]: registry } = await client.Query(Queries.Reports.ReportsFunds.query, {
    variables: { input },
  });
  return registry;
}

/** Движения по фонду за период, страница `page` по `limit` строк. */
export async function loadDeskFundHistory(input: IDeskFundHistoryInput, page: number, limit: number) {
  const { [Queries.Reports.ReportsFundHistory.name]: result } = await client.Query(Queries.Reports.ReportsFundHistory.query, {
    variables: { input, options: { page, limit, sortOrder: 'DESC' } },
  });
  return result;
}

/** Правка описания и процента фонда председателем; правила проверяет сервер до цепи. */
export async function editDeskFund(input: IDeskEditFundInput): Promise<IDeskFund> {
  const { [Mutations.Reports.ReportsEditFund.name]: fund } = await client.Mutation(Mutations.Reports.ReportsEditFund.mutation, {
    variables: { input },
  });
  return fund;
}

/**
 * Реестры бухгалтерии и процессов для страниц стола бухгалтера: те же
 * хранилища, что у общих экранов, но данные приходят операциями стола.
 */
export function useDeskRegistries() {
  const ledger2Store = useLedger2Store();
  const processStore = useProcessStore();
  return {
    loadAccounts: (coopname: string) => ledger2Store.loadAccounts(coopname, DESK_SOURCE),
    loadWallets: (coopname: string) => ledger2Store.loadWallets(coopname, DESK_SOURCE),
    loadHistory: (input: ILedger2HistoryFilterInput) => ledger2Store.loadHistory(input, DESK_SOURCE),
    loadPostings: (input: ILedger2PostingsFilterInput) => ledger2Store.loadPostings(input, DESK_SOURCE),
    loadProcesses: (input: IProcessListInput) => processStore.loadProcesses(input, DESK_SOURCE),
  };
}
