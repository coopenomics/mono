// Состояние раздела «Ключи API»: ключи издателя и его пакеты для выбора.
import { computed, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api, type IApiKey, type IIssueApiKeyInput } from '../api';
import { api as packagesApi } from '../../MyPackages/api';
import { t } from '../../../i18n';

export type { IApiKey, IIssueApiKeyInput };

/** Состояние ключа: действует, истёк либо отозван. */
export type ApiKeyState = 'active' | 'expired' | 'revoked';

export function apiKeyState(key: IApiKey): ApiKeyState {
  if (key.revokedAt) return 'revoked';
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

/** Действующий ключ покрывает пакет: пакет в списке ключа либо ключ на все пакеты. */
export function keyCovers(key: IApiKey, packageId: string): boolean {
  return apiKeyState(key) === 'active' && (key.allPackages || key.packageIds.includes(packageId));
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Данные раздела: ключи издателя и его пакеты для выбора. */
function useKeysData() {
  const keys = ref<IApiKey[]>([]);
  const packageIds = ref<string[]>([]);
  // Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
  const loading = ref(true);
  const error = ref<string | null>(null);

  /** Действующие ключи — первыми, внутри групп — новые первыми. */
  const sortedKeys = computed(() =>
    [...keys.value].sort((a, b) => {
      const live = Number(apiKeyState(b) === 'active') - Number(apiKeyState(a) === 'active');
      return live !== 0 ? live : b.createdAt.localeCompare(a.createdAt);
    }),
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const [loadedKeys, assignments] = await Promise.all([api.myKeys(), packagesApi.myAssignments()]);
      keys.value = loadedKeys;
      packageIds.value = assignments.map((a) => a.packageId).sort();
    } catch (e) {
      error.value = messageOf(e);
    } finally {
      loading.value = false;
    }
  }

  return { keys: sortedKeys, packageIds, loading, error, load };
}

export function useApiKeys() {
  const { keys, packageIds, loading, error, load } = useKeysData();
  const isSubmitting = ref(false);
  const actionError = ref<string | null>(null);
  /** Текст только что выпущенного ключа: каталог отдаёт его один раз. */
  const issuedKey = ref<string | null>(null);

  /** Общая обёртка действия: признак отправки, текст отказа, перечитывание списка. */
  async function act(run: () => Promise<boolean>): Promise<boolean> {
    isSubmitting.value = true;
    actionError.value = null;
    try {
      const ok = await run();
      await load();
      return ok;
    } catch (e) {
      actionError.value = messageOf(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  const issue = (input: IIssueApiKeyInput) =>
    act(async () => {
      issuedKey.value = null;
      const result = await api.issueKey(input);
      if (result.status !== Zeus.CreatePublisherTokenStatus.CREATED || !result.token) {
        actionError.value = result.error || t('developer.keys.issueFailed');
        return false;
      }
      issuedKey.value = result.token;
      return true;
    });

  const revoke = (id: string) =>
    act(async () => {
      const ok = await api.revokeKey(id);
      if (!ok) actionError.value = t('developer.keys.notFound');
      return ok;
    });

  return { keys, packageIds, loading, error, isSubmitting, actionError, issuedKey, load, issue, revoke };
}
