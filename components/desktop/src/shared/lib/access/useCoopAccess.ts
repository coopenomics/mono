import { ref } from 'vue';
import { sendGET } from 'src/shared/api/axios';

/** Гранулярное право (зеркало AccessGrant бэкенда). */
export interface IAccessGrant {
  action: string;
  resource: string;
}

/** Эффективный доступ текущего пайщика (зеркало ParticipantAccess). */
export interface IParticipantAccess {
  sets: string[];
  grants: IAccessGrant[];
}

// Singleton на сессию: грузим один раз, столы/страницы консультируются без повторных запросов.
const access = ref<IParticipantAccess>({ sets: [], grants: [] });
const loaded = ref(false);

/**
 * Эффективный доступ пайщика (Story 6.11) — основание гейтинга столов/страниц по выданным
 * ролям-наборам. `GET /coop/access/me` отдаёт активные наборы + плоский список грантов из
 * Ability пайщика; `can(action, resource)` сверяется с ними. Стол/страница, которым нужен
 * доступ по роли, дёргают `loadAccess()` после входа и гейтятся через `can()` / `hasSet()`.
 *
 * Это CoopID-side seam той же модели resource:action, что и grants marketplace2 — при мердже
 * сводятся (общий getDesktop grants), без дублирования провайдера здесь.
 */
export function useCoopAccess() {
  async function loadAccess(): Promise<void> {
    access.value = (await sendGET('/coop/access/me')) as IParticipantAccess;
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
