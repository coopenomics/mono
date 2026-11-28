import { computed } from 'vue';
import { useSystemStore } from './store';

/**
 * Положение узла в сети — одно определение на весь стол (28.11.2026).
 *
 * Провайдер платформы — главный администратор сети: он регистрирует
 * кооперативы и берёт их на обслуживание. Его имя сообщает узел
 * (`platform_provider`, настройка `PLATFORM_PROVIDER_COOPNAME`), в коде стола
 * имени нет.
 *
 * Оператор кооператива — `parent_username` его строки в реестре сети. Пустое
 * поле значит, что кооператив держит установку сам.
 *
 * Одиночный запуск — у кооператива нет оператора и узел не связан с
 * провайдером подключения: каталога приложений, подписок и кошелька у
 * оператора у такого узла нет, доступны встроенные приложения.
 */
export function useNetworkMode() {
  const system = useSystemStore();

  const platformProvider = computed(() => system.info.platform_provider || '');
  /** Этот узел принадлежит провайдеру платформы. */
  const isPlatformProvider = computed(() => !!platformProvider.value && system.info.coopname === platformProvider.value);
  /** Оператор кооператива узла; `null` — кооператив держит установку сам. */
  const operator = computed(() => system.info.cooperator_account?.parent_username || null);
  /** Узел работает в сети: есть оператор либо связь с провайдером подключения. */
  const isNetworked = computed(() => !!operator.value || !!system.info.is_providered);

  return { platformProvider, isPlatformProvider, operator, isNetworked };
}
