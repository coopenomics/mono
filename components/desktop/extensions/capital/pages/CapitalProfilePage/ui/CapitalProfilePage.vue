<template lang="pug">

.profile-container

  // Заголовок профиля
  .profile-header
    .header-content
      .avatar-section

        AutoAvatar(:username="username")

      .identity-section
        .display-name {{ contributorStore?.self?.display_name }}
      .gamification-section

        ContributorGamificationWidget
    // Кошельки программ
    CapitalWalletsCardsWidget(v-if="contributorStore?.self")

    .about-section
      EditAboutInput(color='teal' :transparent="false" @about-updated="handleFieldUpdated")
    .work-section
      .row

        .col-md-12.col-xs-12
          EditHoursPerDayInput(color="teal" :transparent="false" @hours-updated="handleFieldUpdated")
        .col-md-12.col-xs-12
          EditRatePerHourInput(color="teal" :transparent="false" @rate-updated="handleFieldUpdated")
  // Финансовая информация
  .financial-section
    // Загрузка данных
    template(v-if="!contributorStore?.self")
      .loading-container
        q-spinner(color='grey-5' size='1.5em')
        .loading-label Загрузка данных профиля...


    // Данные загружены
    template(v-else)


      ColorCard(color='teal' :transparent="true")
        // Вклады по ролям
        .contributions-section
          // Общая сумма как первый элемент
          .total-row
            .total-icon
              q-icon(name="bar_chart", size="16px", color="grey-7")
            .total-content
              .total-name Общая сумма взносов
              .total-amount {{ totalContributions }}

          // Детализация по ролям
          .role-row(
            v-for="role in roleContributions"
            :key="role.key"
          ).q-ml-md
            .role-icon
              q-icon(:name="role.icon", size="16px", color="grey-7")
            .role-content
              .role-name {{ role.name }}
              .role-value {{ role.value }}

</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { ContributorGamificationWidget } from 'app/extensions/capital/widgets/ContributorGamificationWidget';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { useSessionStore } from 'src/entities/Session/model/store';
import { useSystemStore } from 'src/entities/System/model';
import { EditAboutInput, EditHoursPerDayInput, EditRatePerHourInput } from 'app/extensions/capital/features/Contributor/EditContributor';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import {ColorCard} from 'src/shared/ui';
import { AutoAvatar } from 'src/shared/ui/domain/AutoAvatar';
import { CapitalWalletsCardsWidget } from 'app/extensions/capital/widgets/CapitalWalletsCardsWidget';
const contributorStore = useContributorStore();
const system = useSystemStore();
const { username } = useSessionStore();

// Вычисляемые свойства
const governSymbol = computed(() => system.info?.symbols?.root_govern_symbol || 'GOV');

// Форматированные вклады по ролям
const formattedInvestor = computed(() => {
  if (!contributorStore.self) return '0.00';
  const value = contributorStore.self?.contributed_as_investor || '0';
  return formatAsset2Digits(`${value} ${governSymbol.value}`);
});

const formattedCreator = computed(() => {
  if (!contributorStore.self) return '0.00';
  const value = contributorStore.self?.contributed_as_creator || '0';
  return formatAsset2Digits(`${value} ${governSymbol.value}`);
});

const formattedAuthor = computed(() => {
  if (!contributorStore.self) return '0.00';
  const value = contributorStore.self?.contributed_as_author || '0';
  return formatAsset2Digits(`${value} ${governSymbol.value}`);
});

const formattedCoordinator = computed(() => {
  if (!contributorStore.self) return '0.00';
  const value = contributorStore.self?.contributed_as_coordinator || '0';
  return formatAsset2Digits(`${value} ${governSymbol.value}`);
});


const formattedContributor = computed(() => {
  if (!contributorStore.self) return '0.00';
  const value = contributorStore.self?.contributed_as_contributor || '0';
  return formatAsset2Digits(`${value} ${governSymbol.value}`);
});

// Сумма всех вкладов по ролям
const totalContributions = computed(() => {
  if (!contributorStore.self) return '0.00';

  const contributions = [
    contributorStore.self?.contributed_as_investor || '0',
    contributorStore.self?.contributed_as_creator || '0',
    contributorStore.self?.contributed_as_author || '0',
    contributorStore.self?.contributed_as_coordinator || '0',
    contributorStore.self?.contributed_as_propertor || '0',
    contributorStore.self?.contributed_as_contributor || '0',
  ];

  const total = contributions.reduce((sum, contribution) => {
    return sum + parseFloat(contribution);
  }, 0);

  return formatAsset2Digits(`${total} ${governSymbol.value}`);
});

// Массив вкладов по ролям для отображения
const roleContributions = computed(() => {
  if (!contributorStore.self) return [];

  return [
    {
      key: 'author',
      name: 'Соавтор',
      value: formattedAuthor.value,
      icon: 'lightbulb',
      color: 'orange'
    },
    {
      key: 'creator',
      name: 'Исполнитель',
      value: formattedCreator.value,
      icon: 'build',
      color: 'blue'
    },
    {
      key: 'investor',
      name: 'Инвестор',
      value: formattedInvestor.value,
      icon: 'account_balance_wallet',
      color: 'green'
    },
    {
      key: 'coordinator',
      name: 'Координатор',
      value: formattedCoordinator.value,
      icon: 'campaign',
      color: 'purple'
    },
    {
      key: 'contributor',
      name: 'Получено в Благорост',
      value: formattedContributor.value,
      icon: 'local_florist',
      color: 'purple'
    }
  ];
});

/**
 * Функция для перезагрузки данных профиля
 * Используется для poll обновлений
 */
const reloadProfileData = async () => {
  try {
    // Для профиля перезагружаем данные участника
    await contributorStore.loadContributor({ username });
  } catch (error) {
    console.warn('Ошибка при перезагрузке данных профиля в poll:', error);
  }
};

// Обработчик обновления любого поля профиля
const handleFieldUpdated = () => {
  // Поле профиля обновлено, данные перезагрузятся автоматически через poll
};

// Настраиваем poll обновление данных
const { start: startProfilePoll, stop: stopProfilePoll } = useDataPoller(
  reloadProfileData,
  { interval: POLL_INTERVALS.SLOW, immediate: false }
);

// Проверяем при монтировании
onMounted(async () => {
  // Загружаем данные текущего участника аналогично CapitalBase
  await contributorStore.loadSelf({ username });
  
  // Запускаем poll обновление данных
  startProfilePoll();
});

// Останавливаем poll при уходе со страницы
onBeforeUnmount(() => {
  stopProfilePoll();
});
</script>

<style lang="scss" scoped>
.profile-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;

  @media (max-width: 768px) {
    padding: 20px 16px;
  }
}

// Заголовок профиля
.profile-header {
  margin-bottom: 32px;

  .header-content {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;

    @media (max-width: 768px) {
      flex-direction: column;
      gap: 16px;
      text-align: center;
      margin-bottom: 16px;
    }
  }

  .avatar-section {
    .avatar-circle {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--q-grey-1, #f5f5f5);
      border: 1px solid var(--q-grey-3, #e0e0e0);
      display: flex;
      align-items: center;
      justify-content: center;

      .q-dark & {
        background: var(--q-grey-9, #1a1a1a);
        border-color: var(--q-grey-7, #424242);
      }
    }
  }

  .identity-section {
    flex: 1;

    .display-name {
      font-size: 24px;
      font-weight: 400;
      letter-spacing: -0.01em;
      margin-bottom: 4px;

      @media (max-width: 768px) {
        font-size: 20px;
      }
    }

    .identity-label {
      font-size: 14px;
      font-weight: 400;
    }
  }

  .gamification-section {
    display: flex;
    align-items: center;
  }

  .about-section {
    margin-top: 16px;
  }
}

// Финансовая информация
.financial-section {
  margin-bottom: 48px;

  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px 0;

    .loading-label {
      font-size: 14px;
      font-weight: 400;
    }
  }

  .contributions-section {
    .total-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 0;
      border-bottom: 1px solid var(--q-grey-3, #e0e0e0);
      margin-bottom: 8px;

      .q-dark & {
        border-color: var(--q-grey-7, #424242);
      }

      .total-icon {
        flex-shrink: 0;
      }

      .total-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex: 1;

        .total-name {
          font-size: 14px;
          font-weight: 400;

        }

        .total-amount {
          font-size: 18px;
          font-weight: 400;

        }
      }
    }

    .role-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid var(--q-grey-2, #e0e0e0);

      .q-dark & {
        border-color: var(--q-grey-8, #424242);
      }

      &:last-child {
        border-bottom: none;
      }

      .role-icon {
        flex-shrink: 0;
      }

      .role-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex: 1;

        .role-name {
          font-size: 14px;
          font-weight: 400;
        }

        .role-value {
          font-size: 16px;
          font-weight: 400;
        }
      }
    }
  }
}

// Разделители
.section-separator {
  height: 1px;
  background: var(--q-grey-2, #e0e0e0);
  margin: 48px 0;

  .q-dark & {
    background: var(--q-grey-8, #424242);
  }
}

// Секции с контентом
.personal-section,
.work-section {
  margin-bottom: 48px;

  .section-label {
    font-size: 18px;
    font-weight: 400;
    margin-bottom: 24px;

    @media (max-width: 768px) {
      font-size: 16px;
    }
  }

  .section-input,
  .work-inputs {
    .input-group {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>

