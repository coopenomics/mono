<template lang="pug">
q-btn(
  color='primary',
  icon='add',
  label='Создать расход',
  unelevated,
  no-caps,
  @click='showDialog = true'
)

q-dialog(v-model='showDialog')
  q-card(style='min-width: 480px')
    q-card-section
      .text-h6 Создать расход программы
      .text-caption.text-grey-7.q-mt-xs Служебная записка (1010) сначала создаётся и подписывается председателем, затем отправляется в реестр.

    q-card-section
      q-banner(rounded, dense, class='bg-orange-1 text-orange-10')
        template(#avatar)
          q-icon(name='construction', color='orange-10')
        | Мастер подачи СЗ ещё не подключён к этой кнопке.
        |
        | Текущая страница показывает уже отправленные расходы и позволяет одобрять/авторизовать/выплачивать их. Полная форма СЗ появится отдельным мастером.

    q-card-actions(align='right')
      q-btn(flat, no-caps, label='Закрыть', v-close-popup)
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const showDialog = ref(false);
</script>
