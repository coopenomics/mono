<template lang="pug">
q-card(v-if='contributorStore.self' flat)

  .q-pa-lg
    .row.items-center.q-mb-md
      q-icon(name='person', size='32px', color='primary')
      .text-h6.q-ml-sm {{ contributorStore.self?.display_name }}
      q-space
      ContributorGamificationWidget


    // Информация о профиле
    .q-mb-lg
      // О себе
      .q-mb-md
        EditAboutInput(@about-updated="handleFieldUpdated")

      // Параметры для исполнителя
      .row
        .col-12.col-sm-6.q-pa-sm
          EditHoursPerDayInput(@hours-updated="handleFieldUpdated")
        .col-12.col-sm-6.q-pa-sm
          EditRatePerHourInput(@rate-updated="handleFieldUpdated")

    .text-body2.text-grey-7.text-weight-bold.q-mb-lg.q-ml-md Взносы по ролям
    // Общая сумма вкладов
    .row.q-mb-md
      .col-12
        ColorCard(color='purple').text-center
          .card-label Сумма взносов
          .card-value {{ totalContributions }}

    .row
        .col-6.col-sm-4.col-md-3.col-lg-2.q-pa-sm
          ColorCard(color='green')
            .card-label.text-center Инвестор
            .card-value {{ formattedInvestor }}
        .col-6.col-sm-4.col-md-3.col-lg-2.q-pa-sm
          ColorCard(color='green')
            .card-label.text-center Исполнитель
            .card-value {{ formattedCreator }}
        .col-6.col-sm-4.col-md-3.col-lg-2.q-pa-sm
          ColorCard(color='green')
            .card-label.text-center Соавтор
            .card-value {{ formattedAuthor }}
        .col-6.col-sm-4.col-md-3.col-lg-2.q-pa-sm
          ColorCard(color='green')
            .card-label.text-center Координатор
            .card-value {{ formattedCoordinator }}
        //- .col-6.col-sm-4.col-md-3.col-lg-2
        //-   ColorCard(color='green')
        //-     .card-label.text-center Пропертор
        //-     .card-value {{ formattedPropertor }}
        //- .col-6.col-sm-4.col-md-3.col-lg-2
        //-   ColorCard(color='green')
        //-     .card-label.text-center Участник
        //-     .card-value {{ formattedContributor }}


</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useSystemStore } from 'src/entities/System/model';
import { EditAboutInput, EditHoursPerDayInput, EditRatePerHourInput } from 'app/extensions/capital/features/Contributor/EditContributor';
import { ContributorGamificationWidget } from 'app/extensions/capital/widgets/ContributorGamificationWidget';
import { ColorCard } from 'src/shared/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';

const contributorStore = useContributorStore();
const { info } = useSystemStore();

// Форматированные вклады по ролям
const formattedInvestor = computed(() => {
  const value = contributorStore.self?.contributed_as_investor || '0';
  return formatAsset2Digits(`${value} ${info.symbols.root_govern_symbol}`);
});

const formattedCreator = computed(() => {
  const value = contributorStore.self?.contributed_as_creator || '0';
  return formatAsset2Digits(`${value} ${info.symbols.root_govern_symbol}`);
});

const formattedAuthor = computed(() => {
  const value = contributorStore.self?.contributed_as_author || '0';
  return formatAsset2Digits(`${value} ${info.symbols.root_govern_symbol}`);
});

const formattedCoordinator = computed(() => {
  const value = contributorStore.self?.contributed_as_coordinator || '0';
  return formatAsset2Digits(`${value} ${info.symbols.root_govern_symbol}`);
});

// const formattedPropertor = computed(() => {
//   const value = contributorStore.self?.contributed_as_propertor || '0';
//   return formatAsset2Digits(`${value} ${info.symbols.root_govern_symbol}`);
// });

// const formattedContributor = computed(() => {
//   const value = contributorStore.self?.contributed_as_contributor || '0';
//   return formatAsset2Digits(`${value} ${info.symbols.root_govern_symbol}`);
// });

// Сумма всех вкладов по ролям
const totalContributions = computed(() => {
  if (!contributorStore.self) return '0.00';

  const contributions = [
    contributorStore.self.contributed_as_investor || '0',
    contributorStore.self.contributed_as_creator || '0',
    contributorStore.self.contributed_as_author || '0',
    contributorStore.self.contributed_as_coordinator || '0',
    contributorStore.self.contributed_as_propertor || '0',
    contributorStore.self.contributed_as_contributor || '0',
  ];

  const total = contributions.reduce((sum, contribution) => {
    return sum + parseFloat(contribution);
  }, 0);

  return formatAsset2Digits(`${total} ${info.symbols.root_govern_symbol}`);
});

// Обработчик обновления любого поля профиля
const handleFieldUpdated = () => {
  // Поле профиля обновлено, данные перезагрузятся автоматически через poll в CapitalProfilePage
};
</script>
