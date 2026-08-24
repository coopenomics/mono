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

export function useConnectionCatalog() {
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

  /** «от N ₽ в месяц» для сводки условий; null — каталог ещё не загружен. */
  const minPriceLabel = computed<string | null>(() => {
    const prices = (catalog.value?.server_options ?? []).map((o) => Number(o.price));
    if (!prices.length) return null;
    return `${formatPrice(Math.min(...prices))} ₽`;
  });

  /** Пробный период хостинга (дней) — максимум по конфигурациям. */
  const trialDays = computed<number | null>(() => {
    const days = (catalog.value?.server_options ?? []).map((o) => o.trial_days);
    if (!days.length) return null;
    return Math.max(...days);
  });

  return { catalog, isLoading, error, load, serverTariffs, mandatoryServices, minPriceLabel, trialDays, formatPrice };
}
