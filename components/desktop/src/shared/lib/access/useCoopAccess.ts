import { ref } from 'vue';
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

/** Эффективный доступ текущего пайщика (тип из @coopenomics/sdk). */
export type IParticipantAccess =
  Queries.Authorization.GetMyAccess.IOutput[typeof Queries.Authorization.GetMyAccess.name];

/** Гранулярное право (тип из @coopenomics/sdk). */
export type IAccessGrant = IParticipantAccess['grants'][number];

// Singleton на сессию: грузим один раз, столы/страницы консультируются без повторных запросов.
const access = ref<IParticipantAccess>({ sets: [], grants: [] });
const loaded = ref(false);

/**
 * Эффективный доступ пайщика (Story 6.11) — основание гейтинга столов/страниц по выданным
 * ролям-наборам. `Queries.Authorization.getMyAccess` отдаёт активные наборы + плоский список
 * грантов из Ability пайщика; `can(action, resource)` сверяется с ними. Стол/страница, которым
 * нужен доступ по роли, дёргают `loadAccess()` после входа и гейтятся через `can()` / `hasSet()`.
 *
 * Через @coopenomics/sdk (Zeus) — прямого REST с фронта нет. Это CoopID-side seam той же
 * модели resource:action, что и grants marketplace2 — при мердже сводятся (общий getDesktop).
 */
export function useCoopAccess() {
  async function loadAccess(): Promise<void> {
    const { [Queries.Authorization.GetMyAccess.name]: result } = await client.Query(
      Queries.Authorization.GetMyAccess.query,
    );
    access.value = result;
    loaded.value = true;
  }

  // 'manage' покрывает любое действие над ресурсом; 'all' — любой ресурс (CASL-wildcard).
  function can(action: string, resource: string): boolean {
    return access.value.grants.some(
      (g) => (g.action === action || g.action === 'manage') && (g.resource === resource || g.resource === 'all'),
    );
  }

  function hasSet(setKey: string): boolean {
    return access.value.sets.includes(setKey);
  }

  return { access, loaded, loadAccess, can, hasSet };
}
