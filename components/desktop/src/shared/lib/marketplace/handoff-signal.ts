import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Кросс-стольная передача отсканированного кода (приёмка → выдача и обратно).
 * Раньше код ехал через query-параметр `handoff` в URL: `router.replace` для
 * его очистки не дожидался, консьюмер вызывался fire-and-forget, и если
 * страница пересобиралась (первый заход на стол в сессии — догрузка стора КУ)
 * в промежутке между переходом и открытием диалога, код уже был стёрт из URL
 * и терялся безвозвратно. Pinia-стор переживает переходы между страницами как
 * есть — тут нечего терять при пересборке компонента.
 */
export const useMarketplaceHandoffSignal = defineStore('marketplaceHandoffSignal', () => {
  const pendingCode = ref<string | null>(null);

  function post(code: string): void {
    pendingCode.value = code;
  }

  /** Забрать код на обработку и сразу освободить — повторный маунт не переспросит то же самое. */
  function consume(): string | null {
    const code = pendingCode.value;
    pendingCode.value = null;
    return code;
  }

  return { pendingCode, post, consume };
});
