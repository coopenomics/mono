<template lang="pug">
//- Страница «Мои взносы» (решение владельца 30–31.10.2026): все паевые взносы
//- пайщика в Благорост одной лентой — деньги, имущество и результаты; кнопки
//- взносов в шапке.
q-page.contributions(role='region', :aria-label='$t("capital.myContributionsPage.ariaLabel")')
  PageHint(storage-key='capital:my-contributions:banner-dismissed')
    | {{ $t('capital.myContributionsPage.hint') }}

  ContributionsFeedWidget(ref='feed')
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { PageHint } from 'src/shared/ui/domain';
import { useHeaderActions } from 'src/shared/hooks/useHeaderActions';
import { CreateProgramInvestButton } from 'app/extensions/capital/features/ProgramInvest/CreateProgramInvest/ui';
import { CreatePropertyContributionButton } from 'app/extensions/capital/features/ProgramProperty';
import { ContributionsFeedWidget } from 'app/extensions/capital/widgets';

const { registerAction } = useHeaderActions();
const feed = ref<InstanceType<typeof ContributionsFeedWidget> | null>(null);

// realtime: нет источника — страница только ставит кнопки в шапку; данные ленты живут в виджете по useLiveReload.
onMounted(() => {
  // Главные действия страницы — в правом верхнем углу топбара.
  registerAction({ id: 'capital-contributions-money', component: CreateProgramInvestButton, order: 1 });
  registerAction({
    id: 'capital-contributions-property',
    component: CreatePropertyContributionButton,
    order: 2,
    props: { onSubmitted: () => feed.value?.reload() },
  });
});
</script>

<style scoped lang="scss">
.contributions {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

@media (max-width: 768px) {
  .contributions {
    padding: var(--p-4);
  }
}
</style>
