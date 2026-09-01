import { ref } from 'vue';
import type { Queries } from '@coopenomics/sdk';
import { api } from '../api';

/** Набор возможностей из каталога + что он открывает (тип из @coopenomics/sdk). */
export type ICapabilitySet =
  Queries.Authorization.GetCapabilitySets.IOutput[typeof Queries.Authorization.GetCapabilitySets.name][number];

/** Назначение набора пайщику (тип из @coopenomics/sdk). */
export type ICapabilitySetAssignment =
  Queries.Authorization.GetParticipantCapabilitySets.IOutput[typeof Queries.Authorization.GetParticipantCapabilitySets.name][number];

/** Гранулярное право: действие над ресурсом (тип из @coopenomics/sdk). */
export type IAccessGrant = ICapabilitySet['grants'][number];

/**
 * Назначаемые наборы возможностей (Story 6.11) — управление ролями пайщиков для
 * страницы «Персонал» стола совета. Каталог наборов + назначения конкретного пайщика
 * + назначить/снять. Бэкенд — через @coopenomics/sdk (Authorization), гейтинг прав на
 * guard'е резолвера; прямого REST с фронта нет — наружу смотрит только SDK.
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
    await api.assignSet({ username, set_key: setKey });
    await loadFor(username);
  }

  async function revoke(username: string, setKey: string): Promise<void> {
    await api.revokeSet({ username, set_key: setKey });
    await loadFor(username);
  }

  return { catalog, assignments, loading, loadCatalog, loadFor, assign, revoke };
}
