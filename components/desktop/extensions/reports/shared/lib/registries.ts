import { ref } from 'vue';
import { Queries } from '@coopenomics/sdk';
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
