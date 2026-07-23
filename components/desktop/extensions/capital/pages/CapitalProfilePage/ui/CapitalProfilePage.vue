<template lang="pug">
//- Профиль участника Благороста: шапка-удостоверение, кошельки программ,
//- редактируемые параметры участия и взносы по ролям
.capital-profile(v-if='contributorStore.self')
  IdentityPanel(:identity='identity')
    template(#actions)
      ContributorGamificationWidget

  CapitalWalletsCardsWidget

  BaseCard(title='Параметры участия')
    .capital-profile__fields
      EditAboutInput(@about-updated='handleFieldUpdated')
      EditHoursPerDayInput(@hours-updated='handleFieldUpdated')
      EditRatePerHourInput(@rate-updated='handleFieldUpdated')

  BaseCard(title='Взносы по ролям')
    //- Итог — выделенной плашкой, детализация — строками с иконками ролей
    .contrib-total
      .contrib-total__label.t-sm.t-muted Общая сумма взносов
      .contrib-total__value {{ totalContributions }}
    .contrib-rows
      .contrib-row(v-for='role in roleContributions', :key='role.key')
        span.contrib-row__icon
          q-icon(:name='role.icon', size='20px')
        .contrib-row__name {{ role.name }}
        .contrib-row__value.t-mono {{ role.value }}

//- Скелетон первичной загрузки (poll обновляет данные молча)
.capital-profile(v-else)
  .capital-profile__skel-head
    .skel.skel--circle.capital-profile__skel-avatar
    .skel.skel--title.capital-profile__skel-name
  .skel.capital-profile__skel-card(v-for='i in 3', :key='i')
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { ContributorGamificationWidget } from 'app/extensions/capital/widgets/ContributorGamificationWidget';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { useSessionStore } from 'src/entities/Session/model/store';
import { useSystemStore } from 'src/entities/System/model';
import { useHeaderActions } from 'src/shared/hooks/useHeaderActions';
import { EditAboutInput, EditHoursPerDayInput, EditRatePerHourInput } from 'app/extensions/capital/features/Contributor/EditContributor';
import { CreateProgramInvestButton } from 'app/extensions/capital/features/ProgramInvest/CreateProgramInvest/ui';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseCard } from 'src/shared/ui/base';
import { IdentityPanel, type Identity } from 'src/shared/ui/domain/IdentityPanel';
import { CapitalWalletsCardsWidget } from 'app/extensions/capital/widgets/CapitalWalletsCardsWidget';

const contributorStore = useContributorStore();
const system = useSystemStore();
const { username } = useSessionStore();
const { registerAction } = useHeaderActions();

// Вычисляемые свойства
const governSymbol = computed(() => system.info?.symbols?.root_govern_symbol || 'GOV');

// Шапка-удостоверение: имя участника + аккаунт
const identity = computed<Identity>(() => ({
  fullName: contributorStore.self?.display_name || '',
  accountName: username,
}));

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
    },
    {
      key: 'creator',
      name: 'Исполнитель',
      value: formattedCreator.value,
      icon: 'build',
    },
    {
      key: 'investor',
      name: 'Инвестор',
      value: formattedInvestor.value,
      icon: 'account_balance_wallet',
    },
    {
      key: 'coordinator',
      name: 'Координатор',
      value: formattedCoordinator.value,
      icon: 'campaign',
    },
    {
      key: 'contributor',
      name: 'Получено в Благорост',
      value: formattedContributor.value,
      icon: 'local_florist',
    },
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
  // Главное действие страницы — в правом верхнем углу топбара
  registerAction({
    id: 'capital-profile-invest',
    component: CreateProgramInvestButton,
    order: 1,
  });

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
.capital-profile {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .capital-profile {
    padding: var(--p-4, 16px);
  }
}

// Редактируемые поля внутри карточки «Параметры участия» —
// hairline-разделители между строками
.capital-profile__fields {
  display: flex;
  flex-direction: column;

  > * {
    padding: var(--p-3) 0;
    border-bottom: 1px solid var(--p-line);
  }

  > *:first-child {
    padding-top: 0;
  }

  > *:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
}

// Взносы по ролям: плашка итога + строки с иконками
.contrib-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-3) var(--p-4);
  margin-bottom: var(--p-2);
  background: var(--p-surface-2);
  border-radius: var(--p-r-md);
}

.contrib-total__value {
  font-family: var(--p-mono);
  font-size: var(--p-fs-h2);
  font-weight: 600;
}

.contrib-row {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  border-bottom: 1px solid var(--p-line);

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
}

.contrib-row__icon {
  width: var(--p-8);
  height: var(--p-8);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--p-r-sm);
  background: var(--p-canvas-2);
  color: var(--p-ink-2);
}

.contrib-row__name {
  flex: 1;
  min-width: 0;
}

.contrib-row__value {
  font-weight: 600;
}

// Скелетон первичной загрузки
.capital-profile__skel-head {
  display: flex;
  align-items: center;
  gap: var(--p-3);
}

.capital-profile__skel-avatar {
  width: var(--p-9);
  height: var(--p-9);
  flex-shrink: 0;
}

.capital-profile__skel-name {
  width: 40%;
}

.capital-profile__skel-card {
  height: var(--p-10);
  border-radius: var(--p-r-md);
}
</style>
