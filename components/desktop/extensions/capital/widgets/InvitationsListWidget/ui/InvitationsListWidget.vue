<template lang="pug">
q-card(flat)

  // Таблица приглашений
  q-table(
    :rows='candidates',
    :columns='columns',
    row-key='username',
    :loading='loading',
    flat,
    square,
    hide-header,
    :no-data-label='loading ? "Загрузка..." : "У вас пока нет приглашений"'
    :pagination="{ rowsPerPage: 0 }"
  )
    template(#no-data="{ message }")
      .full-width.column.flex-center.q-pa-xl.text-grey-7
        q-icon(name="people_outline" size="64px" color="grey-4")
        .text-h6.q-mt-md {{ message }}
        .text-body2.text-center.q-mt-sm(style="max-width: 400px")
          | Приглашайте новых участников по своей ссылке.
          | При каждой регистрации создается "связь", которая действует 30 дней.
          | Если в этот период приглашенный вами участник внесет денежный взнос в любой проект кооператива,
          | вы получите 5% от суммы его взноса в виде доли в объекте авторских прав в том же проекте.
    template(#body='tableProps')
      q-tr(
        :props='tableProps',
        @click='handleInvitationClick(tableProps.row.username)'
        style='cursor: pointer'
        :class='{ "connection-expired": !isConnectionActive(tableProps.row) }'
      )
        q-td(style='width: 35px')
          ExpandToggleButton(
            :expanded='expanded[tableProps.row.username]',
            @click='handleToggleExpand(tableProps.row.username)'
          )
        q-td
          .participant-info
            .row.items-center.q-gutter-sm
              .participant-name {{ tableProps.row.username_display_name || tableProps.row.username }}
              q-badge(:color='getConnectionStatusColor(tableProps.row)') {{ getConnectionStatusLabel(tableProps.row) }}
            .row.items-center.q-gutter-sm.text-caption.text-grey-7
              q-icon(name='event', size='14px')
              div Дата регистрации: {{ tableProps.row.registered_at ? formatDateToHumanDateTime(tableProps.row.registered_at) : 'регистрация не завершена' }}

            .row.q-col-gutter-sm
              .col-md-6.col-sm-12
                ColorCard(color='blue')
                  .card-label Взносы деньгами
                  .card-value {{ formatAsset2Digits(`${tableProps.row.contributed_as_investor || 0} ${info.symbols.root_govern_symbol}`) }}

              .col-md-6.col-sm-12
                ColorCard(color='teal')
                  .card-label Прочие взносы
                  .card-value {{ formatAsset2Digits(`${calculateOtherContributions(tableProps.row)} ${info.symbols.root_govern_symbol}`) }}

      // Детали на развороте
      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='expanded[tableProps.row.username]',
        :key='`e_${tableProps.row.username}`'
      )
        q-td(colspan='100%').expanded-row
          InvitationDetailsWidget(:candidate='tableProps.row')
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useCandidateStore } from 'app/extensions/capital/entities/Candidate';
import { useSessionStore } from 'src/entities/Session/model';
import { useSystemStore } from 'src/entities/System/model';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';
import { formatAsset2Digits, formatDateToHumanDateTime } from 'src/shared/lib/utils';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { InvitationDetailsWidget } from '../../InvitationDetailsWidget';
import { storeToRefs } from 'pinia';

interface Props {
  expanded: Record<string, boolean>;
}

interface Emits {
  (e: 'toggle-expand', value: string): void;
  (e: 'invitation-click', value: string): void;
  (e: 'data-loaded', value: string[]): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const candidateStore = useCandidateStore();
const { candidates, loading } = storeToRefs(candidateStore);
const sessionStore = useSessionStore();
const { info } = useSystemStore();

// Параметр истечения срока годности связи в днях
const CONNECTION_EXPIRY_DAYS = 30;

const columns = [
  { name: 'expand', label: '', align: 'left' as const, field: '' },
  { name: 'participant', label: 'Участник', align: 'left' as const, field: 'username' },
];

const calculateOtherContributions = (candidate: any) => {
  return (
    parseFloat(candidate.contributed_as_creator || '0') +
    parseFloat(candidate.contributed_as_author || '0') +
    parseFloat(candidate.contributed_as_coordinator || '0') +
    parseFloat(candidate.contributed_as_contributor || '0') +
    parseFloat(candidate.contributed_as_propertor || '0')
  );
};

/**
 * Проверка, активна ли связь (не истекла ли она)
 * Связь активна в течение CONNECTION_EXPIRY_DAYS после создания (created_at)
 */
const isConnectionActive = (candidate: any) => {
  if (!candidate.registered_at) return false;

  const registeredAt = new Date(candidate.registered_at).getTime();
  const now = new Date().getTime();
  const diffDays = (now - registeredAt) / (1000 * 60 * 60 * 24);

  return diffDays <= CONNECTION_EXPIRY_DAYS;
};

const getConnectionStatusLabel = (candidate: any) => {
  return isConnectionActive(candidate) ? 'Связь активна' : 'Связь не активна';
};

const getConnectionStatusColor = (candidate: any) => {
  return isConnectionActive(candidate) ? 'positive' : 'negative';
};

const loadMyInvitations = async () => {
  if (!sessionStore.username) return;

  await candidateStore.loadCandidates({
    filter: {
      referer: sessionStore.username,
    },
    options: {
      page: 1,
      limit: 1000,
      sortOrder: 'DESC'
    }
  });

  const usernames = candidates.value.map(c => c.username);
  emit('data-loaded', usernames);
};

const handleInvitationClick = (username: string) => {
  emit('invitation-click', username);
};

const handleToggleExpand = (username: string) => {
  emit('toggle-expand', username);
};

onMounted(async () => {
  await loadMyInvitations();
});
</script>

<style lang="scss" scoped>
.participant-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.participant-name {
  font-weight: 500;
  color: #1976d2;
  font-size: 1.1rem;
}

.expanded-row {
  padding-left: 60px !important;
  @media (max-width: 1023px) {
    padding-left: 0;
  }
}

.connection-expired {
  opacity: 0.7;
  background-color: rgba(0, 0, 0, 0.02);
}

.card-value {
  font-size: 16px;
  font-weight: 500;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.card-label {
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
  margin-bottom: var(--p-1);
}
</style>
