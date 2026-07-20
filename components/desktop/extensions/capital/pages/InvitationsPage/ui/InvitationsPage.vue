<template lang="pug">
div
  WindowLoader(v-show='isInitialLoading', text='Загрузка моих приглашений...')
  q-card(v-show='!isInitialLoading', flat)

    .row.q-mb-md.justify-center.q-pt-md
      .col-md-4.col-xs-12.q-pl-sm.q-pr-sm
        ReferralLinkCard(:link='referralLink' :transparent="false")
      .col-md-4.col-xs-12.q-pl-sm.q-pr-sm
        ColorCard
          .card-label
            span Процент координатора
            q-icon.q-ml-xs(name="help_outline", size="14px", color="grey-6")
            q-tooltip(anchor="top middle" self="bottom middle" :offset="[10, 10]")
              | Размер доли в объекте авторских прав, передаваемой координатору. Рассчитывается как 5% от суммы каждого денежного взноса привлеченного инвестора при условии активной связи
          .card-value 5%
      .col-md-4.col-xs-12.q-pl-sm.q-pr-sm
        ColorCard
          .card-label
            span Срок активности связи
            q-icon.q-ml-xs(name="help_outline", size="14px", color="grey-6")
              q-tooltip(anchor="top middle" self="bottom middle" :offset="[10, 10]")
                | Период времени после регистрации, в течение которого взносы инвестора учитываются для координатора
          .card-value 30 дней

    InvitationsListWidget(
      :expanded='expandedInvitations'
      @toggle-expand='handleInvitationToggleExpand'
      @invitation-click='handleInvitationClick'
      @data-loaded='handleInvitationsDataLoaded'
    )
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useExpandableState, useReferralLink } from 'src/shared/lib/composables';
import { WindowLoader } from 'src/shared/ui/Loader';
import { InvitationsListWidget } from 'app/extensions/capital/widgets';
import { ReferralLinkCard } from 'src/shared/ui/ReferralLinkCard';
import { ColorCard } from 'src/shared/ui/ColorCard/ui';

const { referralLink } = useReferralLink();

// Ключ для сохранения состояния развернутости в LocalStorage
const INVITATIONS_EXPANDED_KEY = 'capital_my_invitations_expanded';

// Состояние первичной загрузки
const isInitialLoading = ref(true);

// Управление развернутостью приглашений (участников)
const {
  expanded: expandedInvitations,
  loadExpandedState: loadInvitationsExpandedState,
  cleanupExpandedByKeys: cleanupInvitationsExpanded,
  toggleExpanded: toggleInvitationExpanded,
} = useExpandableState(INVITATIONS_EXPANDED_KEY);

const handleInvitationToggleExpand = (username: string) => {
  toggleInvitationExpanded(username);
};

const handleInvitationsDataLoaded = (usernames: string[]) => {
  // Очищаем устаревшие записи expanded после загрузки данных
  cleanupInvitationsExpanded(usernames);
  // Отключаем WindowLoader после завершения первичной загрузки
  isInitialLoading.value = false;
};

const handleInvitationClick = (username: string) => {
  toggleInvitationExpanded(username);
};

// Инициализация
onMounted(async () => {
  // Загружаем сохраненное состояние expanded из LocalStorage
  loadInvitationsExpandedState();
});
</script>

<style lang="scss" scoped>
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
