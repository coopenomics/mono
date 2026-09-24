<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="user:programs:banner-dismissed")
    | {{ $t('user.userProgramsPage.hintLine1') }}
    | {{ $t('user.userProgramsPage.hintLine2') }}
    | {{ $t('user.userProgramsPage.hintLine3') }}

  CardListSkeleton(v-if="loading" :count="2")

  EmptyState(
    v-else-if="!programs.length"
    :title="$t('user.userProgramsPage.emptyTitle')"
    :body="$t('user.userProgramsPage.emptyBody')"
  )
    template(#icon)
      q-icon(name="handshake" size="40px")

  template(v-else)
    .row.q-col-gutter-md
      .col-12.col-md-6(v-for="program in programs" :key="program.program_id")
        BaseCard(variant="default")
          template(#head)
            div
              .user-program__title {{ program.title }}
              .t-sm.t-muted(v-if="program.agreement_signed_at") {{ $t('user.userProgramsPage.agreementDate', { date: formatDate(program.agreement_signed_at) }) }}
              .t-sm.t-muted(v-else) {{ $t('user.userProgramsPage.agreementNotSigned') }}
          .user-program__wallets(v-if="program.wallets.length")
            DataRow(
              v-for="wallet in program.wallets"
              :key="wallet.wallet_name"
              :label="wallet.human_name"
              :value="formatAsset2Digits(wallet.balance)"
              :hint="walletHint(wallet)"
              align="spread"
            )
          .t-sm.t-muted(v-else) {{ $t('user.userProgramsPage.walletsEmpty') }}
          q-separator.q-my-md
          DataRow(:label="$t('user.userProgramsPage.refundOnExitLabel')" :value="formatAsset2Digits(program.refund)" align="spread")

    //- Деньгами средства программ забираются одним путём — через выход из
    //- кооператива: так требует Положение каждой программы.
    BaseCard.q-mt-md(variant="default" :title="$t('user.userProgramsPage.cashOutTitle')")
      .t-sm
        | {{ $t('user.userProgramsPage.cashOutTextLine1') }}
        | {{ $t('user.userProgramsPage.cashOutTextLine2') }}
        | {{ $t('user.userProgramsPage.cashOutTextLine3') }}
        | {{ $t('user.userProgramsPage.cashOutTextLine4') }}
      BaseBanner.q-mt-md(v-if="blockers.length" variant="warn")
        template(#icon)
          q-icon(name="block")
        div
          p.q-mb-sm {{ $t('user.userProgramsPage.blockersTitle') }}
          ul.user-program__blockers
            li(v-for="reason in blockers" :key="reason") {{ reason }}
      .q-mt-md
        BaseButton(variant="secondary" @click="goToSettings") {{ $t('user.userProgramsPage.goToExit') }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BaseBanner, BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { FailAlert } from 'src/shared/api';
import { useMembershipExit, type IMembershipExitReturnPreview } from 'src/features/Membership/ExitFromCoop';
import { t, uiLocale } from 'src/shared/i18n';
import { Ledger2Contract } from 'cooptypes';
import { liveTable, useLiveReload } from 'src/shared/lib/realtime';

/**
 * Участие пайщика в целевых потребительских программах: по карточке на
 * программу — соглашение, кошельки с остатками и сумма, возвратная при выходе.
 * Данные берутся из предрасчёта выхода: он обходит ту же таблицу политики
 * кошельков, что и контракт, поэтому цифры здесь и в диалоге выхода совпадают.
 */
const route = useRoute();
const router = useRouter();
const { getReturnPreview } = useMembershipExit();

const loading = ref(true);
const programs = ref<IMembershipExitReturnPreview['programs']>([]);
const blockers = ref<string[]>([]);

const formatDate = (value: unknown): string =>
  value ? new Date(String(value)).toLocaleDateString(uiLocale()) : '______';

function walletHint(wallet: IMembershipExitReturnPreview['programs'][number]['wallets'][number]): string {
  if (wallet.returns) return t('user.userProgramsPage.walletHint.returns');
  if (wallet.policy === 'BLOCKER') return t('user.userProgramsPage.walletHint.blocker');
  return t('user.userProgramsPage.walletHint.kept');
}

function goToSettings(): void {
  void router.push({ name: 'user-settings', params: { coopname: route.params.coopname } });
}

async function load(): Promise<void> {
  try {
    const preview = await getReturnPreview();
    // Кошельки вне программ (минимальный паевой) показывает кошелёк пайщика.
    programs.value = (preview.programs ?? []).filter((program) => program.program_id > 0);
    blockers.value = preview.blockers ?? [];
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// Остатки программ живут в кошельках пайщика: взнос или возврат меняет их без перезахода.
useLiveReload([liveTable(Ledger2Contract, Ledger2Contract.Tables.UserWallets)], load);

onMounted(load);
</script>

<style scoped>
.user-program__title {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
}
.user-program__blockers {
  margin: 0;
  padding-left: var(--p-5);
}
</style>
