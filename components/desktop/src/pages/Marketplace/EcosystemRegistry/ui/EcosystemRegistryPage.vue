<template lang="pug">
q-page.mp-role-admin.q-pa-md
  .text-h5.q-mb-md Экосистема кооперативов

  q-card.mp-card.q-mb-md
    q-card-section
      .text-subtitle1 Текущий кооператив
      .text-body2.text-grey-7.q-mt-xs
        | Кооператив&nbsp;
        strong {{ coopname || '—' }}
        |  установил расширение «Стол заказов». Список других кооперативов с этим же расширением подтянется автоматически, когда платформа сведёт реестр экосистемы.

  q-card.mp-card
    q-card-section
      .text-subtitle1 Другие кооперативы с расширением «Стол заказов»
      .row.items-center.q-pa-md.text-grey-7.q-gutter-sm
        q-icon(name='info' size='20px')
        .text-body2
          | Межкооперативная торговля включится во второй фазе. Сейчас раздел работает в режиме просмотра и остаётся пустым, пока платформа не передаст список соседних кооперативов.
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const coopname = computed(() => String(route.params.coopname ?? ''))
</script>
