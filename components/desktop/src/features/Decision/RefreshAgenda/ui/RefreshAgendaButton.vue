<template lang="pug">
//- Обновление повестки по требованию. Раньше список перечитывался таймером раз
//- в 10 секунд, а один ответ повестки — это пакет документов решений (заявление
//- вместе с положением ЦПП, правилами электронной подписи и прочими: 4–5
//- документов по ~50 КБ, суммарно за 200 КБ). Перекачивать это по кругу в
//- открытой вкладке незачем — пайщик обновляет список тогда, когда ему нужно.
BaseButton(
  variant='ghost',
  :icon-only='true',
  :loading='agendaStore.refreshing',
  aria-label='Обновить повестку',
  @click='onRefresh'
)
  template(#icon-left)
    q-icon(name='refresh', size='20px')
    q-tooltip Обновить повестку
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { useAgendaStore } from 'src/entities/Agenda/model';

const route = useRoute();
const agendaStore = useAgendaStore();

// Guard от повторного нажатия и проглатывание ошибки — внутри store.refresh:
// кнопка живёт в топбаре, вне дерева страницы, и обязана делить состояние с
// дозагрузкой после голосования.
const onRefresh = () => {
  void agendaStore.refresh({ coopname: route.params.coopname as string });
};
</script>
