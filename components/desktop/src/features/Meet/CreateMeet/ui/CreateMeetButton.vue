<template lang="pug">
q-btn(
  @click='showCreateMeetDialog = true',
  :color='micro ? "accent" : "primary"',
  :flat='micro',
  :dense='micro',
  :size='micro ? "sm" : undefined',
  no-wrap
)
  q-icon(name='fa-solid fa-plus')
  span.q-ml-sm(v-if='!micro') Созвать собрание
  q-tooltip(v-if='micro') Созвать собрание

CreateMeetForm(
  v-model='showCreateMeetDialog',
  :loading='isCreating',
  :is-chairman='isChairman',
  @create='handleCreate'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { CreateMeetForm } from './index';
import { createMeetWithAgenda } from '../model';
import { useSessionStore } from 'src/entities/Session';
import { useMeetStore } from 'src/entities/Meet';
import { useRoute } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';

// Определяем пропсы
withDefaults(
  defineProps<{
    isChairman: boolean;
    /** Компактный вид для шапки на мобильном (иконка + tooltip) */
    micro?: boolean;
  }>(),
  { micro: false },
);

const route = useRoute();
const sessionStore = useSessionStore();
const meetStore = useMeetStore();

const showCreateMeetDialog = ref(false);
const isCreating = ref(false);

const handleCreate = async (formData: any) => {
  isCreating.value = true;
  try {
    await createMeetWithAgenda({
      coopname: route.params.coopname as string,
      initiator: formData.initiator,
      presider: formData.presider,
      secretary: formData.secretary,
      open_at: formData.open_at,
      close_at: formData.close_at,
      username: sessionStore.username,
      type: formData.type,
      agenda_points: formData.agenda_points,
      details: formData.details,
    });

    SuccessAlert('Собрание успешно создано');

    // Закрываем диалог
    showCreateMeetDialog.value = false;

    // Обновляем список собраний через стор
    await meetStore.loadMeets({ coopname: route.params.coopname as string });

    return true;
  } catch (e: any) {
    FailAlert(e);
    return false;
  } finally {
    isCreating.value = false;
  }
};
</script>
