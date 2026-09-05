import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api';
import type { IRobotCouncil, IRobotDecisionType, IRobotJournal, IRobotJournalInput, IRobotKeyStatus } from './types';

const namespace = 'robot';

/**
 * Состояние стола «Робот совета»: реестр действий автоматизации, совет,
 * ключ текущего члена совета и журнал решений. Источник — бэкенд, который
 * читает таблицы цепи, поэтому все члены совета видят одно и то же.
 */
export const useRobotStore = defineStore(namespace, () => {
  const registry = ref<IRobotDecisionType[]>([]);
  const council = ref<IRobotCouncil | null>(null);
  const keyStatus = ref<IRobotKeyStatus | null>(null);
  const journal = ref<IRobotJournal | null>(null);
  const keys = ref<IRobotKeyStatus[]>([]);

  /** Типы, которые робот умеет довести до протокола, — первыми. */
  const sortedRegistry = computed(() =>
    [...registry.value].sort((a, b) => Number(b.serviceable) - Number(a.serviceable) || a.title.localeCompare(b.title, 'ru')),
  );

  const titleByType = computed<Record<string, string>>(() =>
    Object.fromEntries(registry.value.map((item) => [item.type, item.title])),
  );

  async function loadRegistry(): Promise<void> {
    registry.value = await api.loadRegistry();
  }

  async function loadCouncil(): Promise<void> {
    council.value = await api.loadCouncil();
  }

  async function loadKeyStatus(): Promise<void> {
    keyStatus.value = await api.loadKeyStatus();
  }

  async function loadKeys(): Promise<void> {
    keys.value = await api.loadKeys();
  }

  async function loadJournal(data: IRobotJournalInput = {}): Promise<void> {
    journal.value = await api.loadJournal(data);
  }

  return {
    registry,
    sortedRegistry,
    titleByType,
    council,
    keyStatus,
    journal,
    keys,
    loadRegistry,
    loadCouncil,
    loadKeyStatus,
    loadKeys,
    loadJournal,
  };
});
