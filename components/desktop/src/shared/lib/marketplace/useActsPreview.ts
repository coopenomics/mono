import { ref, type Ref } from 'vue';

/**
 * Единый паттерн «Показать / Скрыть акты» для диалогов подписи/выдачи marketplace.
 *
 * Кнопка живёт в ряду действий диалога (рядом с «Подписать / Отмена»), а не
 * болтается возле таблицы. По нажатию:
 *   • первый раз — лениво подгружаются документы (`loadPreview`);
 *   • таблица состава скрывается, показываются сгенерированные акты;
 *   • повторное нажатие возвращает таблицу.
 *
 * `showActs` управляет видимостью (`table v-if="!showActs"` / `preview v-if="showActs"`).
 * `resetActs` зовётся при открытии/смене сущности, чтобы каждый раз начинать с
 * таблицы состава без подтянутых от прошлой записи документов.
 */
export function useActsPreview(loadPreview: () => Promise<void>, previewHtml: Ref<string>) {
  const showActs = ref(false);

  async function toggleActs(): Promise<void> {
    if (showActs.value) {
      showActs.value = false;
      return;
    }
    if (!previewHtml.value) await loadPreview();
    // Переходим к актам только если документы реально загрузились: loadPreview
    // мог прерваться валидацией (например, не указан факт) и ничего не вернуть —
    // тогда остаёмся на таблице состава, а не показываем пустоту.
    if (previewHtml.value) showActs.value = true;
  }

  function resetActs(): void {
    showActs.value = false;
    previewHtml.value = '';
  }

  return { showActs, toggleActs, resetActs };
}
