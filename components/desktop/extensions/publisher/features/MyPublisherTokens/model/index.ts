// 487-27: состояние стола «Мои приложения».
import { ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api, type IIssueInput, type IMyPackage, type IMyToken } from '../api';
import { t } from '../../../i18n';

export type { IIssueInput, IMyPackage, IMyToken };

export function useMyPublisherTokens() {
  const packages = ref<IMyPackage[]>([]);
  const tokens = ref<IMyToken[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isSubmitting = ref(false);
  const actionError = ref<string | null>(null);
  /** Plaintext только что выпущенного ключа — показывается один раз. */
  const issuedToken = ref<string | null>(null);

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      [packages.value, tokens.value] = await Promise.all([api.myPackages(), api.myTokens()]);
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function issue(input: IIssueInput): Promise<boolean> {
    isSubmitting.value = true;
    actionError.value = null;
    issuedToken.value = null;
    try {
      const result = await api.issueToken(input);
      if (result.status !== Zeus.CreatePublisherTokenStatus.CREATED || !result.token) {
        actionError.value = result.error || t('publisher.tokens.issueFailed');
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
      const ok = await api.revokeToken(id);
      if (!ok) actionError.value = t('publisher.tokens.notFound');
      await load();
      return ok;
    } catch (e) {
      actionError.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  return { packages, tokens, loading, error, isSubmitting, actionError, issuedToken, load, issue, revoke };
}
