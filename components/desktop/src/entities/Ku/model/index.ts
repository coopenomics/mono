import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api';
import type {
  IKuDecision,
  IKuDecisionsInput,
  IKuTrustRequest,
  IKuTrustRequestsInput,
} from './types';

export * from './types';

const namespace = 'ku';

/**
 * Стор собраний и решений кооперативных участков.
 * Данные — из PG-проекций backend (история сохраняется после завершения в блокчейне).
 */
export const useKuStore = defineStore(namespace, () => {
  const decisions = ref<IKuDecision[]>([]);
  const decisionsTotalCount = ref(0);
  const currentDecision = ref<IKuDecision | null>(null);
  const trustRequests = ref<IKuTrustRequest[]>([]);
  const trustRequestsTotalCount = ref(0);

  async function loadDecisions(data: IKuDecisionsInput): Promise<void> {
    const result = await api.loadDecisions(data);
    decisions.value = result.items;
    decisionsTotalCount.value = result.totalCount;
  }

  async function loadDecision(hash: string): Promise<IKuDecision> {
    const decision = await api.loadDecision(hash);
    currentDecision.value = decision;
    return decision;
  }

  async function loadTrustRequests(data: IKuTrustRequestsInput): Promise<void> {
    const result = await api.loadTrustRequests(data);
    trustRequests.value = result.items;
    trustRequestsTotalCount.value = result.totalCount;
  }

  return {
    decisions,
    decisionsTotalCount,
    currentDecision,
    trustRequests,
    trustRequestsTotalCount,
    loadDecisions,
    loadDecision,
    loadTrustRequests,
  };
});
