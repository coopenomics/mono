/**
 * Имена пайщиков по именам аккаунтов: издатель в списках показывается ФИО,
 * имя аккаунта остаётся подписью. Имя берётся поиском пайщиков — тем же
 * запросом, что у поля выбора пайщика; найденное хранится до перезагрузки стола.
 */
import { reactive } from 'vue';
import { Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

const names = reactive(new Map<string, string>());
/** Аккаунты, по которым запрос уже был: повторно не спрашиваем и при пустом ответе. */
const asked = new Set<string>();

/** ФИО физлица и предпринимателя либо краткое название организации. */
function displayNameOf(data: Record<string, unknown>): string {
  const person = [data.last_name, data.first_name, data.middle_name].filter((part) => typeof part === 'string' && part).join(' ');
  return person || (typeof data.short_name === 'string' ? data.short_name : '');
}

async function lookup(username: string): Promise<void> {
  const { [Queries.Accounts.SearchPrivateAccounts.name]: found } = await client.Query(
    Queries.Accounts.SearchPrivateAccounts.query,
    { variables: { data: { query: username } } },
  );
  const account = found.find((item) => item.data?.username === username);
  const name = account ? displayNameOf(account.data as Record<string, unknown>) : '';
  if (name) names.set(username, name);
}

/** Узнать имена перечисленных аккаунтов. Отказ поиска имя не даёт — список покажет имя аккаунта. */
export async function resolveAccountNames(usernames: string[]): Promise<void> {
  const unknown = [...new Set(usernames)].filter((u) => u && !asked.has(u));
  unknown.forEach((u) => asked.add(u));
  await Promise.allSettled(unknown.map(lookup));
}

/** Имя пайщика либо `null`, пока оно не найдено. */
export function accountName(username: string): string | null {
  return names.get(username) ?? null;
}
