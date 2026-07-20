<template lang="pug">
.participant-card
  .participant-card__head(@click='$emit("toggle-expand")')
    .participant-card__top
      .participant-card__avatar
        q-icon(name='person', size='20px')
      .participant-card__id
        .participant-card__name {{ getName(participant) }}
        .participant-card__account
          q-icon.participant-card__field-icon(name='badge', size='14px')
            q-tooltip Имя аккаунта
          span.participant-card__field-text {{ participant.username }}
          q-icon.participant-card__copy(
            name='content_copy',
            size='14px',
            @click.stop='copyText(participant.username)'
          )
            q-tooltip Скопировать
        .participant-card__email
          q-icon.participant-card__field-icon(name='mail', size='14px')
            q-tooltip Email
          span.participant-card__field-text {{ participant.provider_account?.email || 'Email не указан' }}
      q-icon.participant-card__chevron(
        :name='expanded ? "expand_less" : "expand_more"',
        size='20px'
      )
    //- Статус, дата и удаление — отдельной строкой под идентификацией, чтобы
    //- широкий бейдж («Ожидает решения совета») не сжимал имя/аккаунт/email
    //- до пары букв на узком экране.
    .participant-card__meta
      .participant-card__status
        BaseBadge(:variant='getAccountStatusBadge(participant).variant') {{ getAccountStatusBadge(participant).label }}
      .participant-card__meta-right
        span.participant-card__date {{ joinDate(participant) }}

  q-slide-transition
    .participant-card__body(v-show='expanded')
      ParticipantDetails(
        :participant='participant',
        @update='onUpdate'
      )
</template>

<script setup lang="ts">
import { copyToClipboard, Notify } from 'quasar';
import moment from 'src/shared/lib/utils/dates/moment';
import ParticipantDetails from './ParticipantDetails.vue';
import { getName } from 'src/shared/lib/utils';
import { getAccountStatusBadge } from 'src/entities/Account';
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

async function copyText(text: string): Promise<void> {
  if (!text) return;
  try {
    await copyToClipboard(text);
    Notify.create({ type: 'positive', message: 'Скопировано', timeout: 1200, position: 'top' });
  } catch {
    Notify.create({ type: 'negative', message: 'Не удалось скопировать', timeout: 2000, position: 'top' });
  }
}

// Форматирование даты
const formatDate = (date?: string) => {
  if (!date) return 'Дата не указана';
  const formatted = moment(date).format('DD.MM.YY');
  return formatted === 'Invalid date' ? 'Дата не указана' : formatted;
};

// Дата вступления: приём советом (participant_account), у вышедших запись стёрта —
// фолбэк на дату регистрации аккаунта on-chain (user_account.registered_at).
const joinDate = (row: IAccount): string => {
  const raw = row.participant_account?.created_at || row.user_account?.registered_at;
  return formatDate(raw ? String(raw) : undefined);
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
  /* Отступ между карточками вешаем на саму карточку (внутри grid-item):
     virtual-scroll меряет высоту контента и учитывает этот margin, тогда как
     margin на самом .q-table__grid-item он игнорирует. */
  margin-bottom: 10px;
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
  flex-direction: column;
  gap: var(--p-2, 8px);
  padding: var(--p-4, 16px);
  cursor: pointer;
  transition: background-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.participant-card__head:hover {
  background: var(--p-surface-2);
}

.participant-card__top {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3, 12px);
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
/* Имя/аккаунт/email обрезаются «…» в одну строку, а не рассыпаются в столбик
   по буквам, когда бейдж «Активный пайщик» съедает ширину meta-колонки.
   Полные значения видны в раскрытой карточке (ParticipantDetails). */
.participant-card__name {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.participant-card__account,
.participant-card__email {
  display: flex;
  align-items: center;
  gap: var(--p-1, 4px);
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
}
.participant-card__field-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.participant-card__field-icon {
  flex-shrink: 0;
  color: var(--p-ink-3);
}
.participant-card__copy {
  flex-shrink: 0;
  color: var(--p-ink-3);
  cursor: pointer;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.participant-card__copy:hover {
  color: var(--p-primary);
}

/* Мета-строка под идентификацией: бейдж слева, дата+удаление справа.
   flex-wrap: широкий бейдж («Ожидает решения совета») не наезжает на дату —
   когда не помещается, дата+удаление переносятся на следующую строку. */
.participant-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--p-2, 8px) var(--p-3, 12px);
}
.participant-card__status {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.participant-card__meta-right {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  flex-shrink: 0;
  margin-left: auto;
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
