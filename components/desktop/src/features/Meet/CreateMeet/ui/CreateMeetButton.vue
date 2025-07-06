<template lang="pug">
q-btn(
  @click='showCreateMeetDialog = true',
  color='primary',
  push,
  :stretch='isMobile',
  :size='isMobile ? "sm" : "md"',
  no-wrap
)
  span.q-pr-sm созвать
  i.fa-solid.fa-plus

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
import { Notify } from 'quasar';
import { FailAlert } from 'src/shared/api';
import { useWindowSize } from 'src/shared/hooks';

// Определяем пропсы
defineProps<{
  isChairman: boolean;
}>();

const route = useRoute();
const sessionStore = useSessionStore();
const meetStore = useMeetStore();
const { isMobile } = useWindowSize();

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
    });

    Notify.create({
      message: 'Собрание успешно создано',
      type: 'positive',
    });

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
