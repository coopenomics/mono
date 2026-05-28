<template lang="pug">
.participant-card
  .participant-card__head(@click='$emit("toggle-expand")')
    .participant-card__avatar
      q-icon(name='fa-solid fa-user', size='18px')
    .participant-card__id
      .participant-card__name {{ getName(participant) }}
      .participant-card__account {{ participant.username }}
      .participant-card__email {{ participant.provider_account?.email || 'Email не указан' }}
    .participant-card__meta
      span.participant-card__date {{ formatDate(String(participant.participant_account?.created_at || '')) }}
      q-checkbox(
        :model-value='participant.participant_account?.status === "accepted"',
        disable,
        color='primary',
        size='sm'
      )
        q-tooltip {{ participant.participant_account?.status === 'accepted' ? 'Активен' : 'Неактивен' }}
    q-icon.participant-card__chevron(
      :name='expanded ? "expand_less" : "expand_more"',
      size='20px'
    )

  q-slide-transition
    .participant-card__body(v-show='expanded')
      ParticipantDetails(
        :participant='participant',
        @update='onUpdate'
      )
</template>

<script setup lang="ts">
import moment from 'src/shared/lib/utils/dates/moment';
import ParticipantDetails from './ParticipantDetails.vue';
import { getName } from 'src/shared/lib/utils';
import {
  type IAccount,
  type IIndividualData,
  type IOrganizationData,
  type IEntrepreneurData,
} from 'src/entities/Account/types';

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
.participant-card {
  width: 100%;
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  overflow: hidden;
  transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.participant-card:hover {
  border-color: var(--p-line-2, var(--p-line));
}

.participant-card__head {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  cursor: pointer;
  transition: background-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.participant-card__head:hover {
  background: var(--p-surface-2);
}

.participant-card__avatar {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-primary-soft);
  color: var(--p-primary);
}

.participant-card__id {
  flex: 1 1 auto;
  min-width: 0;
}
.participant-card__name {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}
.participant-card__account,
.participant-card__email {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
  overflow-wrap: anywhere;
}

.participant-card__meta {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--p-1, 4px);
}
.participant-card__date {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-3);
  white-space: nowrap;
}

.participant-card__chevron {
  flex: 0 0 auto;
  align-self: flex-start;
  margin-top: 2px;
  color: var(--p-ink-3);
}

.participant-card__body {
  border-top: 1px solid var(--p-line);
}
</style>
