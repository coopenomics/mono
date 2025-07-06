<template lang="pug">
.participant-card__container
  q-card.participant-card(flat)
    q-card-section.participant-card__header-section(
      :class='{ "cursor-pointer": $q.screen.lt.md }',
      @click='$q.screen.lt.md ? $emit("toggle-expand") : undefined'
    )
      .participant-header
        .participant-icon
          q-icon(name='fa-solid fa-user', size='24px', color='primary')
        .participant-title
          .title {{ getName(participant) }}
          .subtitle {{ participant.username }}
          .email {{ participant.provider_account?.email || 'Email не указан' }}
      .participant-status
        .joined-date {{ formatDate(String(participant.participant_account?.created_at || '')) }}
        .status
          q-badge(
            :color='participant.participant_account?.status === "accepted" ? "positive" : "grey"'
          ) {{ participant.participant_account?.status === 'accepted' ? 'Активен' : 'Неактивен' }}

    q-slide-transition
      div(v-show='expanded')
        q-separator
        q-card-section
          ParticipantDetails(
            :participant='participant',
            :tab-name='currentTab',
            @update='onUpdate'
          )

  .card-actions-external
    q-btn(
      flat,
      dense,
      size='sm',
      :icon='expanded ? "expand_less" : "expand_more"',
      @click.stop='$emit("toggle-expand")',
      color='primary',
      round
    )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useQuasar } from 'quasar';
import moment from 'moment-with-locales-es6';
import ParticipantDetails from './ParticipantDetails.vue';
import 'src/shared/ui/CardStyles/index.scss';
import { getName } from 'src/shared/lib/utils';
import {
  type IAccount,
  type IIndividualData,
  type IOrganizationData,
  type IEntrepreneurData,
} from 'src/entities/Account/types';

const $q = useQuasar();

const props = defineProps<{
  participant: IAccount;
  expanded?: boolean;
}>();

const emit = defineEmits<{
  'toggle-expand': [];
  update: [
    participant: IAccount,
    newData: IIndividualData | IOrganizationData | IEntrepreneurData,
  ];
}>();

// Локальное состояние
const currentTab = ref('info');

// Форматирование даты
const formatDate = (date?: string) => {
  if (!date) return 'Дата не указана';
  const formatted = moment(date).format('DD.MM.YY');
  return formatted === 'Invalid date' ? 'Дата не указана' : formatted;
};

const onUpdate = (
  newData: IIndividualData | IOrganizationData | IEntrepreneurData,
) => {
  emit('update', props.participant, newData);
};
</script>

<style lang="scss" scoped>
.participant-card__container {
  padding: 8px;
  width: 100%;
}

.participant-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease-in-out;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
}

.participant-card__header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.participant-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.participant-title .title {
  font-size: 16px;
  font-weight: 500;
}

.participant-title .subtitle {
  font-size: 12px;
  color: #757575;
}

.participant-title .email {
  font-size: 12px;
  color: #757575;
}

.participant-status {
  text-align: right;
}

.participant-status .joined-date {
  font-size: 12px;
  color: #757575;
  margin-bottom: 4px;
}

.participant-status .status {
  margin-top: 4px;
}

.card-actions-external {
  display: flex;
  justify-content: center;
  padding: 4px;
}
</style>
