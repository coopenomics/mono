// Состояние страницы «Мои пакеты»: пакеты издателя, их цены и наличие ключа API.
import { computed, ref } from 'vue';
import { api, type IMyAssignment } from '../api';
import { api as pricingApi, type IPackagePricing, type ISetPackagePricingInput } from '../../PackagePricing/api';
import { api as keysApi, type IApiKey } from '../../ApiKeys/api';
import { keyCovers } from '../../ApiKeys/model';

export type { IPackagePricing };

/**
 * Шаг пути пакета к каталогу:
 *  - `registered` — пакет записан на издателя, первый выпуск ещё не подан;
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
  /** Цена; `null` — цена не назначена и первый выпуск не подан. */
  pricing: IPackagePricing | null;
  /** Пакет покрыт действующим ключом API: ключом на этот пакет либо на все пакеты. */
  hasKey: boolean;
  stage: PackageStage;
}

/** Цену назначают при регистрации (487-37): цена без выпуска — шаг «ждёт первого выпуска». */
function stageOf(pricing: IPackagePricing | null): PackageStage {
  if (!pricing || !pricing.inCatalog) return 'registered';
  if (pricing.lastActiveVersion) return 'active';
  return pricing.rubPerMonth == null ? 'needsPrice' : 'moderation';
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Данные страницы: назначения издателя, цены и ключи, сведённые в список пакетов. */
function usePackagesData() {
  const assignments = ref<IMyAssignment[]>([]);
  const pricing = ref<IPackagePricing[]>([]);
  const tokens = ref<IApiKey[]>([]);
  // Признак включён с самого начала: до конца первой загрузки на экране каркас, а не «пусто».
  const loading = ref(true);
  const error = ref<string | null>(null);

  const packages = computed<IMyPackage[]>(() =>
    assignments.value.map((a) => {
      const price = pricing.value.find((p) => p.packageId === a.packageId) ?? null;
      return {
        packageId: a.packageId,
        name: a.packageId.split('/')[1] ?? a.packageId,
        registeredAt: a.createdAt,
        pricing: price,
        hasKey: tokens.value.some((token) => keyCovers(token, a.packageId)),
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
        keysApi.myKeys(),
      ]);
    } catch (e) {
      error.value = messageOf(e);
    } finally {
      loading.value = false;
    }
  }

  return { packages, loading, error, load };
}

/** Цена при регистрации: рубли в месяц и пробный срок. */
export interface IRegisterPrice {
  rubPerMonth: number;
  trialDays: number;
}

export function useMyPackages() {
  const { packages, loading, error, load } = usePackagesData();
  const isSubmitting = ref(false);
  const actionError = ref<string | null>(null);

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
      // Регистрация могла пройти до отказа в цене: список перечитывается и тогда.
      await load();
      return false;
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Регистрация пакета и цена одним действием: цену каталог принимает до первого выпуска. */
  const register = (username: string, packageId: string, price: IRegisterPrice) =>
    act(async () => {
      await api.registerPackage(username, packageId);
      await pricingApi.setPricing({ packageId, ...price });
      return true;
    });

  const setPrice = (data: ISetPackagePricingInput) =>
    act(async () => {
      await pricingApi.setPricing(data);
      return true;
    });

  return { packages, loading, error, isSubmitting, actionError, load, register, setPrice };
}
