import { Zeus } from '@coopenomics/sdk';
import { useSessionStore } from 'src/entities/Session';
import { programPropertyApi } from 'app/extensions/capital/features/ProgramProperty';

/** Маршрут страницы «Мои взносы» — ключ бейджа на пункте меню. */
export const CONTRIBUTIONS_ROUTE = 'capital-contributions';

/**
 * Сколько дел за пайщиком на странице «Мои взносы»: акты приёма-передачи
 * имущества, по которым совет принял решение и ждёт подписи пайщика.
 */
export async function contributionsAttentionCount(): Promise<number> {
  const session = useSessionStore();
  if (!session.username) return 0;
  const page = await programPropertyApi.loadProgramProperties({
    filter: { username: session.username, status: Zeus.ProgramPropertyStatus.AUTHORIZED },
    options: { page: 1, limit: 1 },
  });
  return page.totalCount;
}
