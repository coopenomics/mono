import { ref, computed } from 'vue';
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import type { ITariff } from 'src/entities/ConnectionAgreement';

/**
 * Каталог витрины подключения (Epic 28, форм-фактор §7): живые услуги и
 * конфигурации сервера провайдера вместо хардкода в степпере. Один общий
 * стейт на процесс подключения: и селектор тарифа, и сводка условий слева
 * читают одну загрузку.
 */
export type ProviderConnectionCatalog =
  Queries.System.GetProviderConnectionCatalog.IOutput[typeof Queries.System.GetProviderConnectionCatalog.name];

const catalog = ref<ProviderConnectionCatalog | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

const formatPrice = (value: number | string): string => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString('ru-RU') : String(value);
};

const specsLabel = (specs: Record<string, unknown> | null | undefined): string => {
  if (!specs) return '';
  const cpu = specs.cpu != null ? `${specs.cpu} CPU` : null;
  const ram = specs.ram_gb != null ? `${specs.ram_gb} ГБ RAM` : null;
  const disk = specs.disk ? String(specs.disk) : null;
  return [cpu, ram, disk].filter(Boolean).join(' · ') || String(specs.label ?? '');
};

/**
 * Каталог загружается один раз на процесс подключения: и селектор тарифа, и
 * сводка условий, и реестр подписок читают один стейт, поэтому производные
 * величины живут рядом с ним, а не пересобираются на каждый вызов composable.
 */
const load = async (force = false): Promise<void> => {
  if (catalog.value && !force) return;
  isLoading.value = true;
  error.value = null;
  try {
    const { [Queries.System.GetProviderConnectionCatalog.name]: data } = await client.Query(
      Queries.System.GetProviderConnectionCatalog.query,
      { variables: {} },
    );
    catalog.value = data;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Каталог тарифов временно недоступен';
  } finally {
    isLoading.value = false;
  }
};

/** Конфигурации сервера как тарифы селектора. */
const serverTariffs = computed<ITariff[]>(() =>
  (catalog.value?.server_options ?? []).map((option) => ({
    id: String(option.instance_type_id),
    name: option.name,
    price: `${formatPrice(option.price)} ₽`,
    specs: specsLabel(option.specs as Record<string, unknown> | null),
    trialDays: option.trial_days,
    instanceTypeId: option.instance_type_id,
    subscriptionTypeId: option.subscription_type_id,
  })),
);

/** Обязательные платные услуги — показываются как «также входит». */
const mandatoryServices = computed(() =>
  (catalog.value?.types ?? []).filter((t) => t.is_mandatory && Number(t.price) > 0),
);

/** Самая дешёвая конфигурация сервера, ₽/мес; null — каталог ещё не загружен. */
const minServerPrice = computed<number | null>(() => {
  const prices = (catalog.value?.server_options ?? []).map((o) => Number(o.price));
  return prices.length ? Math.min(...prices) : null;
});

/** Цена конкретной конфигурации сервера, ₽/мес. */
const serverPrice = (instanceTypeId?: number | null): number | null => {
  if (instanceTypeId == null) return null;
  const option = (catalog.value?.server_options ?? []).find(
    (o) => o.instance_type_id === instanceTypeId,
  );
  return option ? Number(option.price) : null;
};

/**
 * Обязательные услуги суммой за месяц. Сервер — не вся плата: документооборот
 * заводится каждому кооперативу и стоит своих денег, поэтому в сводке
 * условий он обязан участвовать, а не всплывать после подключения.
 */
const mandatoryMonthlyTotal = computed<number>(() =>
  mandatoryServices.value.reduce((sum, t) => sum + Number(t.price), 0),
);

/**
 * Полная ежемесячная плата: конфигурация сервера плюс обязательные услуги.
 * Без instanceTypeId считается по самой дешёвой конфигурации — это и есть
 * «от N ₽». null — каталог ещё не загружен.
 */
const monthlyTotal = (instanceTypeId?: number | null): number | null => {
  const server = serverPrice(instanceTypeId) ?? minServerPrice.value;
  if (server == null) return null;
  return server + mandatoryMonthlyTotal.value;
};

/** «от N ₽» по минимальной конфигурации — без обязательных услуг. */
const minPriceLabel = computed<string | null>(() =>
  minServerPrice.value == null ? null : `${formatPrice(minServerPrice.value)} ₽`,
);

/** Пробный период хостинга (дней) — максимум по конфигурациям. */
const trialDays = computed<number | null>(() => {
  const days = (catalog.value?.server_options ?? []).map((o) => o.trial_days);
  if (!days.length) return null;
  return Math.max(...days);
});

export function useConnectionCatalog() {
  return {
    catalog,
    isLoading,
    error,
    load,
    serverTariffs,
    mandatoryServices,
    mandatoryMonthlyTotal,
    minServerPrice,
    serverPrice,
    monthlyTotal,
    minPriceLabel,
    trialDays,
    formatPrice,
  };
}
