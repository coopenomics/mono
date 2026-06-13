import { ref } from 'vue';
import { api } from '../api';

/** Гранулярное право: действие над ресурсом (зеркало AccessGrant бэкенда). */
export interface IAccessGrant {
  action: string;
  resource: string;
}

/** Набор возможностей из каталога + что он открывает (зеркало CapabilitySetWithGrants). */
export interface ICapabilitySet {
  setKey: string;
  title: string;
  description: string;
  builtin: boolean;
  coopname: string | null;
  grants: IAccessGrant[];
}

/** Назначение набора пайщику (зеркало CapabilitySetAssignment). */
export interface ICapabilitySetAssignment {
  username: string;
  setKey: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string | null;
}

/**
 * Назначаемые наборы возможностей (Story 6.11) — управление ролями пайщиков для
 * страницы «Персонал» стола совета. Каталог наборов + назначения конкретного пайщика
 * + назначить/снять. Бэкенд — REST coop/capability-sets (гейтинг прав на guard'е).
 */
export function useCapabilitySets() {
  const catalog = ref<ICapabilitySet[]>([]);
  const assignments = ref<ICapabilitySetAssignment[]>([]);
  const loading = ref(false);

  async function loadCatalog(): Promise<void> {
    catalog.value = await api.getCapabilitySets();
  }

  async function loadFor(username: string): Promise<void> {
    loading.value = true;
    try {
      assignments.value = await api.getParticipantSets(username);
    } finally {
      loading.value = false;
    }
  }

  async function assign(username: string, setKey: string): Promise<void> {
    await api.assignSet({ username, setKey });
    await loadFor(username);
  }

  async function revoke(username: string, setKey: string): Promise<void> {
    await api.revokeSet({ username, setKey });
    await loadFor(username);
  }

  return { catalog, assignments, loading, loadCatalog, loadFor, assign, revoke };
}
