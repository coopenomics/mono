<template lang="pug">
.invitations-list
  //- Пустое состояние — канон EmptyState на surface (без серой «прижатой» зоны q-table)
  EmptyState(
    v-if='!loading && candidates.length === 0',
    title='У вас пока нет приглашений',
    body='Приглашайте новых участников по своей ссылке. При каждой регистрации создаётся связь на 30 дней: если в этот период приглашённый внесёт денежный взнос в проект, вы получите 5% от суммы в виде доли в ОАП того же проекта.'
  )
    template(#icon)
      q-icon(name='people_outline')

  //- Список приглашений
  q-table(
    v-else,
    :rows='candidates',
    :columns='columns',
    row-key='username',
    :loading='loading',
    flat,
    square,
    hide-header,
    hide-bottom,
    :pagination="{ rowsPerPage: 0 }"
  )
    template(#body='tableProps')
      q-tr(
        :props='tableProps',
        @click='handleInvitationClick(tableProps.row.username)',
        :class='{ "connection-expired": !isConnectionActive(tableProps.row) }'
      )
        q-td.invitations-list__expand
          ExpandToggleButton(
            :expanded='expanded[tableProps.row.username]',
            @click='handleToggleExpand(tableProps.row.username)'
          )
        q-td
          .participant-info
            .row.items-center.q-gutter-sm
              .participant-name {{ tableProps.row.username_display_name || tableProps.row.username }}
              BaseBadge(:variant='getConnectionStatusVariant(tableProps.row)')
                | {{ getConnectionStatusLabel(tableProps.row) }}
            .row.items-center.q-gutter-sm.t-sm.t-muted
              q-icon(name='event', size='14px')
              div Дата регистрации: {{ tableProps.row.registered_at ? formatDateToHumanDateTime(tableProps.row.registered_at) : 'регистрация не завершена' }}

            .row.q-col-gutter-sm.q-mt-sm
              .col-md-6.col-sm-12
                WalletCard(
                  compact,
                  neutral,
                  title='Взносы деньгами',
                  :balance='formatMoneyAmount(tableProps.row.contributed_as_investor)',
                  :symbol='governSymbol',
                  balance-label='как инвестор',
                  icon='payments'
                )
              .col-md-6.col-sm-12
                WalletCard(
                  compact,
                  neutral,
                  title='Прочие взносы',
                  :balance='formatMoneyAmount(calculateOtherContributions(tableProps.row))',
                  :symbol='governSymbol',
                  balance-label='прочие роли',
                  icon='handshake'
                )

      q-tr.q-virtual-scroll--with-prev(
        no-hover,
        v-if='expanded[tableProps.row.username]',
        :key='`e_${tableProps.row.username}`'
      )
        q-td(colspan='100%').expanded-row
          InvitationDetailsWidget(:candidate='tableProps.row')
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useCandidateStore } from 'app/extensions/capital/entities/Candidate';
import { useSessionStore } from 'src/entities/Session/model';
import { useSystemStore } from 'src/entities/System/model';
import { formatAsset2Digits, formatDateToHumanDateTime } from 'src/shared/lib/utils';
import { ExpandToggleButton } from 'src/shared/ui/ExpandToggleButton';
import { EmptyState, BaseBadge } from 'src/shared/ui/base';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
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

const CONNECTION_EXPIRY_DAYS = 30;

const governSymbol = computed(
  () => info.symbols?.root_govern_symbol || 'RUB',
);

const columns = [
  { name: 'expand', label: '', align: 'left' as const, field: '' },
  { name: 'participant', label: 'Участник', align: 'left' as const, field: 'username' },
];

const calculateOtherContributions = (candidate: {
  contributed_as_creator?: string;
  contributed_as_author?: string;
  contributed_as_coordinator?: string;
  contributed_as_contributor?: string;
  contributed_as_propertor?: string;
}) => {
  return (
    parseFloat(candidate.contributed_as_creator || '0') +
    parseFloat(candidate.contributed_as_author || '0') +
    parseFloat(candidate.contributed_as_coordinator || '0') +
    parseFloat(candidate.contributed_as_contributor || '0') +
    parseFloat(candidate.contributed_as_propertor || '0')
  );
};

function formatMoneyAmount(raw: string | number | undefined): string {
  const formatted = formatAsset2Digits(`${raw || 0} ${governSymbol.value}`);
  return formatted.split(' ')[0] || '0,00';
}

const isConnectionActive = (candidate: { registered_at?: string | null }) => {
  if (!candidate.registered_at) return false;

  const registeredAt = new Date(candidate.registered_at).getTime();
  const now = new Date().getTime();
  const diffDays = (now - registeredAt) / (1000 * 60 * 60 * 24);

  return diffDays <= CONNECTION_EXPIRY_DAYS;
};

const getConnectionStatusLabel = (candidate: { registered_at?: string | null }) => {
  return isConnectionActive(candidate) ? 'Связь активна' : 'Связь не активна';
};

const getConnectionStatusVariant = (candidate: { registered_at?: string | null }) => {
  return isConnectionActive(candidate) ? 'pos' as const : 'neg' as const;
};

const loadMyInvitations = async () => {
  if (!sessionStore.username) {
    emit('data-loaded', []);
    return;
  }

  await candidateStore.loadCandidates({
    filter: {
      referer: sessionStore.username,
    },
    options: {
      page: 1,
      limit: 1000,
      sortOrder: 'DESC',
    },
  });

  const usernames = candidates.value.map((c) => c.username);
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
.invitations-list {
  flex: 1;
  min-height: 0;
}

.invitations-list__expand {
  width: 35px;
}

.participant-info {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding: var(--p-2) 0;
}

.participant-name {
  font-weight: 500;
  color: var(--p-primary);
  font-size: var(--p-fs-body);
}

.expanded-row {
  padding-left: var(--p-10) !important;
  @media (max-width: 1023px) {
    padding-left: 0;
  }
}

.connection-expired {
  opacity: 0.7;
  background-color: var(--p-surface-2);
}

:deep(.q-table) {
  background: transparent;
}

:deep(.q-tr) {
  cursor: pointer;
}
</style>
