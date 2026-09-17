<template lang="pug">
div(v-html="renderedHtml").statement
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PropType } from 'vue';
import DOMPurify from 'dompurify';
import { sanitizeDocumentHtml } from 'src/shared/lib/utils';

const props = defineProps({
  html: {
    type: String,
    required: true,
  },
  /**
   * Показ без очистки больше не предусмотрен: документ собирается из данных
   * пайщика, а автоэкранирование в шаблонах выключено намеренно — значит имя
   * или адрес с угловыми скобками пришли бы сюда разметкой.
   *
   * `strict` — обычный текст: срезается всё, чего в тексте быть не должно.
   * `document` — документ со своей вёрсткой: сохраняем `<style>`, таблицы и
   * выравнивание, иначе изменился бы вид уже подписанных документов.
   */
  profile: {
    type: String as PropType<'strict' | 'document'>,
    default: 'strict',
  },
});

const renderedHtml = computed(() =>
  props.profile === 'document' ? sanitizeDocumentHtml(props.html) : DOMPurify.sanitize(props.html)
);
</script>

<style>
.digital-document {
  padding: 0px !important;
}

.statement h1 {
  font-weight: 700 !important;
  line-height: 4.5rem !important;
  font-size: 3rem !important;
}

@media (max-width: 600px) {
  .statement h1 {
    font-size: 1.5rem !important;
    line-height: 2rem !important;
  }
}

.statement h3 {
  font-size: 2rem !important;
  font-weight: 400 !important;
  line-height: 2rem !important;
  letter-spacing: normal !important;
}

@media (max-width: 600px) {
  .statement h3 {
    font-size: 1rem !important;
    line-height: 1.5rem !important;
    /* Добавить или изменить другие стили по мере необходимости */
  }
}
</style>
