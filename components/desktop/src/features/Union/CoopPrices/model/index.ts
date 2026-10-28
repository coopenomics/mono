import { ref, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { api, type ICoopPrice, type ICoopService, type ISetCoopPriceInput } from '../api';

/**
 * Индивидуальные цены услуг кооператива (решение владельца 28.10.2026).
 * Оператор назначает цену заранее: витрина кооператива и его новые подписки
 * берут её сразу, живые подписки услуги переоцениваются провайдером.
 */
export function useCoopPrices(coopname: MaybeRefOrGetter<string>) {
  const prices = ref<ICoopPrice[]>([]);
  const services = ref<ICoopService[]>([]);
  const loading = ref(false);

  const load = async (): Promise<void> => {
    const name = toValue(coopname);
    if (!name) return;
    loading.value = true;
    try {
      const [rows, types] = await Promise.all([api.loadCoopPrices(name), api.loadCoopServices(name)]);
      prices.value = rows;
      services.value = types;
    } finally {
      loading.value = false;
    }
  };

  const set = async (data: Omit<ISetCoopPriceInput, 'coopname'>): Promise<ICoopPrice> => {
    const saved = await api.setCoopPrice({ ...data, coopname: toValue(coopname) });
    await load();
    return saved;
  };

  const remove = async (subscriptionTypeId: number): Promise<void> => {
    await api.removeCoopPrice({ coopname: toValue(coopname), subscription_type_id: subscriptionTypeId });
    await load();
  };

  // realtime: нет источника — цены ведёт сервер провайдера (другой узел), в ленте цепи их нет; после своей мутации список перечитывается сразу.
  watch(() => toValue(coopname), () => void load(), { immediate: true });

  return { prices, services, loading, load, set, remove };
}
