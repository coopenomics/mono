<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="user:programs:banner-dismissed")
    | Целевые потребительские программы, в которых вы участвуете. Средства программ
    | живут на их кошельках: ими оплачивается участие, а деньгами они возвращаются
    | при выходе из кооператива.

  CardListSkeleton(v-if="loading" :count="2")

  EmptyState(
    v-else-if="!programs.length"
    title="Вы пока не участвуете в программах"
    body="Программы кооператива открываются на своих столах — там же подписывается соглашение об участии."
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
              .t-sm.t-muted(v-if="program.agreement_signed_at") Соглашение от {{ formatDate(program.agreement_signed_at) }}
              .t-sm.t-muted(v-else) Соглашение об участии не подписано
          .user-program__wallets(v-if="program.wallets.length")
            DataRow(
              v-for="wallet in program.wallets"
              :key="wallet.wallet_name"
              :label="wallet.human_name"
              :value="formatAsset2Digits(wallet.balance)"
              :hint="walletHint(wallet)"
              align="spread"
            )
          .t-sm.t-muted(v-else) На кошельках программы пусто.
          q-separator.q-my-md
          DataRow(label="Вернётся при выходе" :value="formatAsset2Digits(program.refund)" align="spread")

    //- Деньгами средства программ забираются одним путём — через выход из
    //- кооператива: так требует Положение каждой программы.
    BaseCard.q-mt-md(variant="default" title="Получить средства программ деньгами")
      .t-sm
        | Остатки кошельков, возвратные по Положениям программ, возвращаются при выходе
        | из кооператива: они собираются на главный паевой кошелёк и выплачиваются на
        | ваши реквизиты после решения Совета. Заявление об аннулировании соглашений
        | подписывается вместе с заявлением о выходе — по одному на все программы.
      BaseBanner.q-mt-md(v-if="blockers.length" variant="warn")
        template(#icon)
          q-icon(name="block")
        div
          p.q-mb-sm Сейчас выйти нельзя:
          ul.user-program__blockers
            li(v-for="reason in blockers" :key="reason") {{ reason }}
      .q-mt-md
        BaseButton(variant="secondary" @click="goToSettings") Перейти к выходу из кооператива
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BaseBanner, BaseButton, BaseCard, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { FailAlert } from 'src/shared/api';
import { useMembershipExit, type IMembershipExitReturnPreview } from 'src/features/Membership/ExitFromCoop';

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
  value ? new Date(String(value)).toLocaleDateString('ru-RU') : '______';

function walletHint(wallet: IMembershipExitReturnPreview['programs'][number]['wallets'][number]): string {
  if (wallet.returns) return 'Возвращается при выходе из кооператива';
  if (wallet.policy === 'BLOCKER') return 'Остаток держит выход: сначала завершите обязательство';
  return 'Остаётся кооперативу по условиям Положения программы';
}

function goToSettings(): void {
  void router.push({ name: 'user-settings', params: { coopname: route.params.coopname } });
}

onMounted(async () => {
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
});
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
