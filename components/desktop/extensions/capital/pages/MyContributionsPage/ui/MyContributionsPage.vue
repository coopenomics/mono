<template lang="pug">
//- Страница «Мои взносы» (решение владельца 30.10.2026): все паевые взносы
//- пайщика в Благорост в одном месте — кнопки взносов в шапке, история
//- внесённого и взносы имуществом с шагами процесса.
q-page.contributions(role='region', :aria-label='$t("capital.myContributionsPage.ariaLabel")')
  PageHint(storage-key='capital:my-contributions:banner-dismissed')
    | {{ $t('capital.myContributionsPage.hint') }}

  PageTabs(:tabs='tabs', :active-key='activeKey', @select='(tab) => (activeKey = tab.key)')

  ContributionsHistoryWidget(v-if='activeKey === "history"', ref='history')
  ProgramPropertiesWidget(v-else, ref='properties')
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { PageHint } from 'src/shared/ui/domain';
import { PageTabs, type PageTab } from 'src/shared/ui/layout';
import { useHeaderActions } from 'src/shared/hooks/useHeaderActions';
import { CreateProgramInvestButton } from 'app/extensions/capital/features/ProgramInvest/CreateProgramInvest/ui';
import { CreatePropertyContributionButton } from 'app/extensions/capital/features/ProgramProperty';
import { ContributionsHistoryWidget, ProgramPropertiesWidget } from 'app/extensions/capital/widgets';
import { t } from '../../../i18n';

const { registerAction } = useHeaderActions();

const activeKey = ref<'history' | 'property'>('history');
const tabs = computed<PageTab[]>(() => [
  { key: 'history', label: t('capital.myContributionsPage.tabHistory') },
  { key: 'property', label: t('capital.myContributionsPage.tabProperty') },
]);

onMounted(() => {
  // Главные действия страницы — в правом верхнем углу топбара. После заявления
  // об имуществе пайщик видит его на вкладке «Имущество».
  registerAction({ id: 'capital-contributions-money', component: CreateProgramInvestButton, order: 1 });
  registerAction({
    id: 'capital-contributions-property',
    component: CreatePropertyContributionButton,
    order: 2,
    props: { onSubmitted: () => (activeKey.value = 'property') },
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
