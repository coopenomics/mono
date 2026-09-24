<template lang="pug">
//- Мои приглашения: surface-плоскость + канон-карточки шапки (как профиль / расходы).
.invitations-page
  WindowLoader(v-show='isInitialLoading', :text='$t("capital.invitationsPage.loadingText")')
  .invitations-page__body(v-show='!isInitialLoading')
    //- Ссылка — тот же .wallet, что WalletCard: иконка + заголовок + URL слева, копировать справа.
    .wallet.invitations-link(
      role='button',
      tabindex='0',
      :title='$t("capital.invitationsPage.copyLinkTitle")',
      @click='copyReferralLink',
      @keydown.enter.prevent='copyReferralLink',
      @keydown.space.prevent='copyReferralLink'
    )
      span.wallet__icon
        q-icon(name='link')
      .wallet__body
        .wallet__main
          .wallet__title {{ $t('capital.invitationsPage.linkLabel') }}
          .wallet__sub.t-mono(:title='referralLink') {{ referralLink }}
        .wallet__amount
          .wallet__metric
            .wallet__metric-label
              q-icon(name='content_copy')
              | {{ $t('common.action.copy') }}

    .row.q-col-gutter-md
      .col-12.col-md-6
        WalletCard(
          neutral,
          :title='$t("capital.invitationsPage.coordinatorPercentTitle")',
          balance='5',
          symbol='%',
          :balance-label='$t("capital.invitationsPage.coordinatorPercentBalanceLabel")',
          icon='percent'
        )
      .col-12.col-md-6
        WalletCard(
          neutral,
          :title='$t("capital.invitationsPage.linkTtlTitle")',
          balance='30',
          :symbol='$t("capital.invitationsPage.daysSymbol")',
          :balance-label='$t("capital.invitationsPage.linkTtlBalanceLabel")',
          icon='schedule'
        )

    InvitationsListWidget(
      :expanded='expandedInvitations',
      @toggle-expand='handleInvitationToggleExpand',
      @invitation-click='handleInvitationClick',
      @data-loaded='handleInvitationsDataLoaded'
    )
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { copyToClipboard } from 'quasar';
import { useExpandableState, useReferralLink } from 'src/shared/lib/composables';
import { WindowLoader } from 'src/shared/ui/Loader';
import { InvitationsListWidget } from 'app/extensions/capital/widgets';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { t } from '../../../i18n';

const { referralLink } = useReferralLink();

const INVITATIONS_EXPANDED_KEY = 'capital_my_invitations_expanded';

const isInitialLoading = ref(true);

const {
  expanded: expandedInvitations,
  loadExpandedState: loadInvitationsExpandedState,
  cleanupExpandedByKeys: cleanupInvitationsExpanded,
  toggleExpanded: toggleInvitationExpanded,
} = useExpandableState(INVITATIONS_EXPANDED_KEY);

async function copyReferralLink(): Promise<void> {
  try {
    await copyToClipboard(referralLink.value);
    SuccessAlert(t('capital.invitationsPage.copySuccess'));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    FailAlert(t('capital.invitationsPage.copyError') + msg);
  }
}

const handleInvitationToggleExpand = (username: string) => {
  toggleInvitationExpanded(username);
};

const handleInvitationsDataLoaded = (usernames: string[]) => {
  cleanupInvitationsExpanded(usernames);
  isInitialLoading.value = false;
};

const handleInvitationClick = (username: string) => {
  toggleInvitationExpanded(username);
};

// realtime: нет источника на странице — при открытии читается только раскрытие строк из браузера, данные грузит живой виджет списка.
onMounted(() => {
  loadInvitationsExpandedState();
});
</script>

<style lang="scss" scoped>
.invitations-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  padding: var(--p-6);
  background: var(--p-surface);
  min-height: calc(100vh - var(--p-topbar-h));
}

.invitations-page__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  flex: 1;
  min-height: 0;
}

/* Нейтральная иконка как у WalletCard(neutral); кликабельность карточки. */
.invitations-link {
  --prog-bg: var(--p-canvas-2);
  --prog-fg: var(--p-ink-2);
  cursor: pointer;
  width: 100%;
  text-align: left;
}

.invitations-link:focus-visible {
  outline: none;
  box-shadow: var(--p-focus-ring);
}

@media (max-width: 768px) {
  .invitations-page {
    padding: var(--p-4);
  }
}
</style>
