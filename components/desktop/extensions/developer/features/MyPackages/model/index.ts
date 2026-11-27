// Состояние страницы «Мои пакеты»: пакеты издателя, их цены и ключи каталога.
import { computed, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { api, type IIssueInput, type IMyAssignment, type IMyToken } from '../api';
import { api as pricingApi, type IPackagePricing, type ISetPackagePricingInput } from '../../PackagePricing/api';
import { t } from '../../../i18n';

export type { IIssueInput, IMyToken, IPackagePricing };

/**
 * Шаг пути пакета к каталогу:
 *  - `registered` — пакет записан на издателя, каталог о нём ещё не знает;
 *  - `needsPrice` — первый выпуск подан, без цены модератор его не одобряет;
 *  - `moderation` — цена назначена, действующего выпуска ещё нет;
 *  - `active` — у пакета есть действующий выпуск.
 */
export type PackageStage = 'registered' | 'needsPrice' | 'moderation' | 'active';

export interface IMyPackage {
  packageId: string;
  /** Имя приложения без пространства кооператива: его принимают команды набора издателя. */
  name: string;
  registeredAt: string;
  /** Цена из каталога; `null` — первый выпуск ещё не подан. */
  pricing: IPackagePricing | null;
  tokens: IMyToken[];
  stage: PackageStage;
}

function stageOf(pricing: IPackagePricing | null): PackageStage {
  if (!pricing) return 'registered';
  if (pricing.lastActiveVersion) return 'active';
  return pricing.rubPerMonth == null ? 'needsPrice' : 'moderation';
}

/** Ключ действует: не отозван и срок не истёк. */
export function isLiveToken(token: IMyToken): boolean {
  if (token.revokedAt) return false;
  return !token.expiresAt || new Date(token.expiresAt).getTime() > Date.now();
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useMyPackages() {
  const assignments = ref<IMyAssignment[]>([]);
  const pricing = ref<IPackagePricing[]>([]);
  const tokens = ref<IMyToken[]>([]);
  // Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
  const loading = ref(true);
  const error = ref<string | null>(null);
  const isSubmitting = ref(false);
  const actionError = ref<string | null>(null);
  /** Текст только что выпущенного ключа: каталог отдаёт его один раз. */
  const issuedToken = ref<string | null>(null);

  const packages = computed<IMyPackage[]>(() =>
    assignments.value.map((a) => {
      const price = pricing.value.find((p) => p.packageId === a.packageId) ?? null;
      return {
        packageId: a.packageId,
        name: a.packageId.split('/')[1] ?? a.packageId,
        registeredAt: a.createdAt,
        pricing: price,
        tokens: tokens.value.filter((token) => token.packageId === a.packageId),
        stage: stageOf(price),
      };
    }),
  );

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      [assignments.value, pricing.value, tokens.value] = await Promise.all([
        api.myAssignments(),
        pricingApi.listPricing(),
        api.myTokens(),
      ]);
    } catch (e) {
      error.value = messageOf(e);
    } finally {
      loading.value = false;
    }
  }

  /** Общая обёртка действия: признак отправки, текст отказа, перечитывание списка. */
  async function act(run: () => Promise<boolean>): Promise<boolean> {
    isSubmitting.value = true;
    actionError.value = null;
    try {
      const ok = await run();
      if (ok) await load();
      return ok;
    } catch (e) {
      actionError.value = messageOf(e);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  const register = (username: string, packageId: string) =>
    act(async () => {
      await api.registerPackage(username, packageId);
      return true;
    });

  const setPrice = (data: ISetPackagePricingInput) =>
    act(async () => {
      await pricingApi.setPricing(data);
      return true;
    });

  const issue = (input: IIssueInput) =>
    act(async () => {
      issuedToken.value = null;
      const result = await api.issueToken(input);
      if (result.status !== Zeus.CreatePublisherTokenStatus.CREATED || !result.token) {
        actionError.value = result.error || t('developer.keys.issueFailed');
        return false;
      }
      issuedToken.value = result.token;
      return true;
    });

  const revoke = (id: string) =>
    act(async () => {
      const ok = await api.revokeToken(id);
      if (!ok) actionError.value = t('developer.keys.notFound');
      return ok;
    });

  return { packages, loading, error, isSubmitting, actionError, issuedToken, load, register, setPrice, issue, revoke };
}
