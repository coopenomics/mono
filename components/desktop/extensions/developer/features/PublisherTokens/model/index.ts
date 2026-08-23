// 487-27: состояние страницы издателей стола разработчика.
import { ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api, type ICreatePublisherTokenInput, type IPublisherToken } from '../api';

export type { ICreatePublisherTokenInput, IPublisherToken };

export function usePublisherTokens() {
  const items = ref<IPublisherToken[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      items.value = await api.listPublisherTokens();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  const isSubmitting = ref(false);
  const actionError = ref<string | null>(null);
  /** Plaintext только что выданного токена — показывается один раз. */
  const issuedToken = ref<string | null>(null);

  async function create(input: ICreatePublisherTokenInput): Promise<boolean> {
    isSubmitting.value = true;
    actionError.value = null;
    issuedToken.value = null;
    try {
      const result = await api.createPublisherToken(input);
      if (result.status !== Zeus.CreatePublisherTokenStatus.CREATED || !result.token) {
        actionError.value = result.error || 'Не удалось выдать токен';
        return false;
      }
      issuedToken.value = result.token;
      await load();
      return true;
    } catch (e) {
      actionError.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  async function revoke(id: string): Promise<boolean> {
    isSubmitting.value = true;
    actionError.value = null;
    try {
      const ok = await api.revokePublisherToken(id);
      if (!ok) actionError.value = 'Токен не найден или уже отозван';
      await load();
      return ok;
    } catch (e) {
      actionError.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  return { items, loading, error, isSubmitting, actionError, issuedToken, load, create, revoke };
}
