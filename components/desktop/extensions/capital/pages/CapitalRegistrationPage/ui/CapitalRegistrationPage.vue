<template lang="pug">
// ВРЕМЕННЫЙ КОСТЫЛЬ: проверка для пользователей из белого списка без Contributor
div(v-if="shouldShowTemporaryStub").q-pt-md
  .temporary-stub-section
    .stub-content
      .stub-header.text-center.q-mb-lg
        .stub-icon.q-mb-md
          q-icon(name="info" size="48px" color="primary")
        .text-h6.q-mb-md Ранним участникам

      .stub-body.text-center
        .text-body1.q-mb-lg.text-grey-8
          | Перед тем как продолжить, нам необходимо начислить вам дополнительный паевой взнос за раннее участие.
          | Пожалуйста, для уточнения порядка внесения и суммы обратитесь в поддержку по почте <strong>support@coopenomics.world</strong> или через чат на странице "Поддержка" на сайте.

.q-pa-md(v-else)
  q-card(flat).q-pa-lg
    // Шапка страницы с прогресс-баром
    .q-mb-xl
      q-linear-progress(
        :value="getProgressValue()"
        color="primary"
        size="4px"
        rounded
      )

    // Контейнер для текущего шага
    .step-container
      // Шаг 1: Выбор ролей
      template(v-if="currentStep === steps.roles")
        .text-center.q-mb-lg
          .text-h6.q-mb-md Выбор ролей участия
          .text-body2.text-grey-7
            | Вы можете принимать участие в разных ролях. Выберите те, которые вам интересны:

        // Карточки ролей
        .q-mt-xl
          RoleSelector(
            v-model="selectedRoles"
            :roles="roleOptions"
          )

        // Навигация
        .q-mt-xl.text-center
          q-btn(
            color="primary"
            label="Продолжить"
            :disable="selectedRoles.length === 0"
            size="lg"
            @click="nextStep"
          )

      // Шаг 2: Ресурс времени
      template(v-if="currentStep === steps.timeResource && isCreatorRoleSelected")

        .time-resource-section.q-pa-lg
          .time-section
            .section-header.text-center.q-mb-lg
              .text-h6.q-mb-md Ресурс времени
              .text-body2.text-grey-6
                | Сколько профессионального времени в день вы готовы предоставить для создания результатов?

            .hours-selector
              .hours-grid
                .hour-option(
                  v-for="hour in [1, 2, 3, 4, 5, 6, 7, 8]"
                  :key="hour"
                  :class="{ 'selected': hoursPerDay === hour }"
                  @click="hoursPerDay = hour"
                )
                  .hour-number {{ hour }}
                  .hour-label час{{ getHourSuffix(hour) }}

        // Навигация
        .q-mt-xl.row.justify-between
          q-btn(
            flat
            label="Назад"
            @click="prevStep"
          )
          q-btn(
            color="primary"
            label="Продолжить"
            size="lg"
            :disable="hoursPerDay === ''"
            @click="nextStep"
          )

      // Шаг 3: Стоимость результата за час
      template(v-if="currentStep === steps.rateResource && isCreatorRoleSelected")

        .rate-resource-section.q-pa-lg
          .rate-section
            .section-header.text-center.q-mb-lg
              .text-h6.q-mb-md Стоимость результата за час
              .text-body2.text-grey-6
                | Во сколько вы оцениваете стоимость своего времени?

            .rate-input-container
              .rate-input-wrapper
                q-input(
                  v-model="ratePerHour"
                  type="number"
                  label="Стоимость за час"
                  min="0"
                  step="100"
                  :rules="[val => val >= 0 || 'Ставка должна быть не отрицательной', val => val <= 3000 || 'Слишком много для нас. 3000 - максимум']"
                  required
                  class="rate-input"
                  standout="bg-teal text-white"
                )
                  template(#append)
                    .text-body2.currency-symbol {{ governSymbol }}

        // Навигация
        .q-mt-xl.row.justify-between
          q-btn(
            flat
            label="Назад"
            @click="prevStep"
          )
          q-btn(
            color="primary"
            label="Продолжить"
            size="lg"
            :disable="!ratePerHour"
            @click="nextStep"
          )

      // Шаг 3: О себе
      template(v-if="currentStep === steps.about")
        .about-section.q-pa-lg
          .text-center.q-mb-lg
            .text-h6.q-mb-md Информация о себе


          .text-body1.q-mb-lg.text-grey-8
            | Расскажите о себе, вашем опыте и том, чем вы можете быть полезны в проектах. Информация будет использоваться как шаблон при отправке запроса на участие в конкретном проекте, и только тогда она станет доступна другим пайщикам на просмотр. Вы всегда сможете изменить информацию о себе позже.

          .row.justify-center
            q-input(
              v-model="about"
              type="textarea"
              label="О себе"
              standout="bg-teal text-white"
              rows="10"
            ).full-width

        // Навигация
        .q-mt-xl.row.justify-between
          q-btn(
            flat
            label="Назад"
            @click="prevStep"
          )
          q-btn(
            color="primary"
            label="Продолжить"
            size="lg"
            @click="nextStep"
          )

      // Шаг 4: Подписание документов участия
      template(v-if="currentStep === steps.document")
        .document-section.q-pa-lg
          // Загрузка документов
          template(v-if='isGeneratingCapitalDocs')
            .text-center.q-py-xl
              q-spinner(color='primary' size='3em')
              .q-mt-md.text-body2 Генерация документов...

          // Показ документов для подписания
          template(v-else-if='hasGeneratedDocuments')
            .documents-view.q-mb-lg
              .text-h6.q-mb-md.text-center Ознакомьтесь с документами и подпишите их:

              // Договор УХД (только для НЕ импортированных участников)
              .document-card.q-mb-lg(v-if='generatedCapitalDocuments?.generation_contract && !contributorStore.self?.is_external_contract')
                .text-subtitle1.q-mb-md 1. Договор об участии в управлении хозяйственной деятельностью
                .document-content.q-pa-lg.border.rounded-borders
                  DocumentHtmlReader(:html='generatedCapitalDocuments.generation_contract.html')

              // Соглашение о хранении (всегда)
              .document-card.q-mb-lg(v-if='generatedCapitalDocuments?.storage_agreement')
                .text-subtitle1.q-mb-md(:class='contributorStore.self?.is_external_contract ? "1" : "2"') {{ contributorStore.self?.is_external_contract ? '1' : '2' }}. Соглашение о хранении имущества
                .document-content.q-pa-lg.border.rounded-borders
                  DocumentHtmlReader(:html='generatedCapitalDocuments.storage_agreement.html')

              // Соглашение Благорост (только для пути Генератора)
              .document-card.q-mb-lg(v-if='generatedCapitalDocuments?.blagorost_agreement')
                .text-subtitle1.q-mb-md 3. Соглашение о программе Благорост
                .document-content.q-pa-lg.border.rounded-borders
                  DocumentHtmlReader(:html='generatedCapitalDocuments.blagorost_agreement.html')

              // Оферта Генератор (для пути благороста)
              .document-card.q-mb-lg(v-if='generatedCapitalDocuments?.generator_offer')
                .text-subtitle1.q-mb-md 3. Оферта о программе Генератор
                .document-content.q-pa-lg.border.rounded-borders
                  DocumentHtmlReader(:html='generatedCapitalDocuments.generator_offer.html')

          // Ошибка генерации
          template(v-else-if='capitalDocsGenerationError')
            .error-section.text-center.q-py-xl
              .text-negative.q-mb-md
                | Ошибка при генерации документов.
              q-btn(
                color='primary'
                label='Повторить генерацию'
                :loading='isGeneratingCapitalDocs'
                @click='regenerateCapitalDocuments'
              )

        // Навигация
        .q-mt-xl.text-center
          q-btn(
            v-if='hasGeneratedDocuments && !isGeneratingCapitalDocs'
            color='primary'
            label='Подписать и отправить'
            size="lg"
            :loading='isCompleting'
            @click='signAndCompleteRegistration'
          )

      // Шаг 5: Завершение
      template(v-if="currentStep === steps.completed")
        .completion-section.text-center.q-pa-xl
          .success-icon.q-mb-lg
            q-icon(name="check_circle" size="80px" color="positive")
          .text-h5.q-mb-md Добро пожаловать в "Благорост"!
          .text-body1.q-mb-lg.text-grey-8
            | Вы успешно зарегистрировались в кооперативной системе генерации и благороста результатов интеллектуальной деятельности.

          q-btn(
            color="primary"
            label="Перейти в профиль"
            size="lg"
            @click="goToWallet"
          )
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGenerateCapitalRegistrationDocuments } from 'app/extensions/capital/features/Contributor/GenerateCapitalRegistrationDocuments/model';
import { useCompleteCapitalRegistration } from 'app/extensions/capital/features/Contributor/CompleteCapitalRegistration/model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { RoleSelector } from 'app/extensions/capital/shared/ui';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { useSessionStore } from 'src/entities/Session';

const router = useRouter();
const contributorStore = useContributorStore();
const system = useSystemStore();
const session = useSessionStore();

// Шаги регистрации
const steps = {
  roles: 'roles',
  timeResource: 'time-resource',
  rateResource: 'rate-resource',
  about: 'about',
  document: 'document',
  completed: 'completed'
};

const currentStep = ref(steps.roles);


// Роли
const roleOptions = [
  {
    value: 'master',
    title: 'Мастер',
    description: 'Управляет процессом создания результатов интеллектуальной деятельности'
  },
  {
    value: 'noble',
    title: 'Соавтор',
    description: 'Предлагает идеи результатов интеллектуальной деятельности'
  },
  {
    value: 'benefactor',
    title: 'Исполнитель',
    description: 'Создает результаты интеллектуальной деятельности своим трудом'
  },
  {
    value: 'philanthropist',
    title: 'Инвестор',
    description: 'Вкладывает деньги в результаты'
  },
  {
    value: 'herald',
    title: 'Координатор',
    description: 'Распространяет информацию и привлекает финансирование в результаты'
  }
];

// Вычисляемые свойства
const governSymbol = computed(() => system.info.symbols.root_govern_symbol);
const isCreatorRoleSelected = computed(() => selectedRoles.value.includes('benefactor'));

// ВРЕМЕННЫЙ КОСТЫЛЬ: проверка для пользователей из белого списка без Contributor
// Этот костыль необходим для информирования ранних участников о необходимости импорта.
// Ранние участники должны сначала вручную написать и подписать документ, после чего их импортируют в систему.
// Костыль останется до тех пор, пока все ранние участники не будут импортированы и не завершат регистрацию.
const temporaryStubUsernames = [
  'zlvsujtoctal',
  'ipesgnlxmnwx',
  'ndrlqjeptxhh',
  'hntppjjknmsu',
  'vvqamckynxod',
  'zxfevlujlica',
  'spnpcpshemqp',
  'yxkjufikzxri',
  'nqjoctcfusxs',
  'honruwpdxtty',
  'jifhmzxomaug',
  'mrgpikzesygk'
];
const shouldShowTemporaryStub = computed(() => {
  return temporaryStubUsernames.includes(session.username) && !contributorStore.self?.username;
});

// Проверяем, есть ли сгенерированные документы от бэкенда

// Проверяем, есть ли сгенерированные документы от бэкенда
const hasGeneratedDocuments = computed(() => {
  return !!generatedCapitalDocuments.value &&
    (generatedCapitalDocuments.value.generation_contract ||
     generatedCapitalDocuments.value.storage_agreement ||
     generatedCapitalDocuments.value.blagorost_agreement ||
     generatedCapitalDocuments.value.generator_offer);
});


// Бизнес-логика для генерации пачки документов Capital
const {
  generateDocuments: generateCapitalDocuments,
  regenerateDocuments: regenerateCapitalDocuments,
  isGenerating: isGeneratingCapitalDocs,
  generatedDocuments: generatedCapitalDocuments,
  generationError: capitalDocsGenerationError,
} = useGenerateCapitalRegistrationDocuments();

// Бизнес-логика для завершения регистрации
const {
  completeRegistration,
  isCompleting,
} = useCompleteCapitalRegistration();


// Поля формы для регистрации участия
const selectedRoles = ref<string[]>([]);
const hoursPerDay = ref<number | ''>('');
const ratePerHour = ref<number | ''>('');
const about = ref('');

// Получение последовательности всех шагов
const getStepSequence = () => {
  try {
    const baseSteps = [steps.roles, steps.about, steps.document, steps.completed];
    if (isCreatorRoleSelected?.value) {
      return [steps.roles, steps.timeResource, steps.rateResource, steps.about, steps.document, steps.completed];
    }
    return baseSteps;
  } catch (error) {
    console.warn('Error getting step sequence:', error);
    return [steps.roles, steps.about, steps.document, steps.completed];
  }
};

// Функция для расчета прогресса (должна быть определена до использования в шаблоне)
const getProgressValue = () => {
  try {
    const sequence = getStepSequence();
    const currentIndex = sequence.indexOf(currentStep.value);
    if (currentIndex === -1 || sequence.length === 0) return 0;
    return (currentIndex + 1) / sequence.length;
  } catch (error) {
    console.warn('Error calculating progress value:', error);
    return 0;
  }
};




// Функция для правильного склонения слова "час"
const getHourSuffix = (hour: number): string => {
  if (hour === 1) return '';
  if (hour >= 5 || hour === 0) return 'ов';
  return 'а';
};

// Вычисляемые свойства для проверки завершения шагов (теперь из contributorStore)


// Навигация по шагам
const nextStep = () => {
  const sequence = getStepSequence();
  const currentIndex = sequence.indexOf(currentStep.value);
  if (currentIndex < sequence.length - 1) {
    currentStep.value = sequence[currentIndex + 1];
  }
};

const prevStep = () => {
  const sequence = getStepSequence();
  const currentIndex = sequence.indexOf(currentStep.value);
  if (currentIndex > 0) {
    currentStep.value = sequence[currentIndex - 1];
  }
};

// Обновление текущего шага на основе состояния регистрации
const updateCurrentStep = () => {
  // Проверяем статус участника из блокчейна
  const blockchainStatus = contributorStore.self?.blockchain_status;

  // Если статус "import" - участник импортирован, но не завершил регистрацию
  // Показываем процесс регистрации с самого начала (без договора УХД)
  if (blockchainStatus === 'import') {
    currentStep.value = steps.roles;
  } else if (!contributorStore.isContributorActiveOrPending) {
    // Если регистрация участия не завершена, начинаем с выбора ролей
    currentStep.value = steps.roles;
  } else {
    // Регистрация завершена (статус "active") - переходим к завершению
    currentStep.value = steps.completed;
  }
};

// Следим за изменениями статуса регистрации
watch(() => contributorStore.isContributorActiveOrPending, updateCurrentStep);

/**
 * Функция для перезагрузки данных регистрации
 * Используется для poll обновлений
 */
const reloadRegistrationData = async () => {
  try {
    // Для страницы регистрации обновляем статус участника
    await contributorStore.loadContributor({ username: session.username });
  } catch (error) {
    console.warn('Ошибка при перезагрузке данных регистрации в poll:', error);
  }
};

// Настраиваем poll обновление данных
const { start: startRegistrationPoll, stop: stopRegistrationPoll } = useDataPoller(
  reloadRegistrationData,
  { interval: POLL_INTERVALS.SLOW, immediate: false }
);

// Инициализация при монтировании
onMounted(() => {
  console.log('🎯 CapitalRegistrationPage mounted');
  updateCurrentStep();

  // Запускаем poll обновление данных
  startRegistrationPoll();

  // Генерация пачки документов Capital при монтировании (только если не показывается временный заглушка)
  if (!shouldShowTemporaryStub.value) {
    generateCapitalDocuments()
      .then((documents) => {
        console.log('✅ Пачка документов сгенерирована:', {
          generation_contract: documents?.generation_contract?.hash,
          storage_agreement: documents?.storage_agreement?.hash,
          blagorost_agreement: documents?.blagorost_agreement?.hash,
        });
      })
      .catch((error) => {
        console.error('❌ Ошибка при генерации пачки документов:', error);
        FailAlert('Не удалось сгенерировать документы регистрации');
      });
  }

});

// Останавливаем poll при уходе со страницы
onBeforeUnmount(() => {
  stopRegistrationPoll();
});

// Отслеживание размонтирования
onUnmounted(() => {
  console.log('💥 CapitalRegistrationPage unmounted');
});

// Подпись и завершение регистрации с пачкой документов
const signAndCompleteRegistration = async () => {
  try {
    if (!generatedCapitalDocuments.value) {
      throw new Error('Документы не сгенерированы');
    }

    const { generation_contract, storage_agreement, blagorost_agreement, generator_offer } = generatedCapitalDocuments.value;

    if (!storage_agreement) {
      throw new Error('Отсутствуют обязательные документы');
    }

    // Если бэкенд вернул соглашение Благорост, оно будет отправлено в блокчейн

    // Отправляем документы в блокчейн с данными формы регистрации
    // Contributor будет создан автоматически на бэкенде, если не существует
    await completeRegistration(
      generation_contract,
      storage_agreement,
      blagorost_agreement,
      generator_offer,
      {
        about: about.value,
        rate_per_hour: ratePerHour.value?.toString(),
        hours_per_day: hoursPerDay.value ? Number(hoursPerDay.value) : undefined,
      }
    );

    SuccessAlert('Документы успешно подписаны и отправлены в блокчейн');

    // После успешной регистрации обновление статуса произойдет автоматически через реактивность
  } catch (error) {
    console.error('Ошибка при завершении регистрации:', error);
    FailAlert(error);
  }
};


// Переход в кошелек
const goToWallet = () => {
  router.push({ name: 'capital-wallet' });
};

</script>

<style lang="scss" scoped>
.step-container {
  min-height: 500px;
}

.time-resource-section,
.rate-resource-section,
.about-section,
.document-section,
.agreement-section {
  max-width: 800px;
  margin: 0 auto;
  background: var(--q-light-background, #fafafa);
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}

.body--dark .time-resource-section,
.body--dark .rate-resource-section,
.body--dark .about-section,
.body--dark .document-section,
.body--dark .agreement-section {
  background: var(--q-dark-background, #1a1a1a);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
}

.time-buttons {
  justify-content: center;
}

.section-header {
  display: flex;
  flex-direction: column;
  align-items: center;

  .text-h6 {
    font-weight: 500;
    letter-spacing: -0.02em;
    text-align: center;
  }

  .text-body2 {
    font-weight: 400;
    line-height: 1.5;
    text-align: center;
  }
}

.hours-selector {
  max-width: 760px;
  margin: 0 auto;
}

.hours-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  gap: 10px;
  justify-items: center;
}

.hour-option {
  width: 70px;
  height: 70px;
  border-radius: 20px;
  background: var(--q-card-background, #ffffff);
  border: 2px solid var(--q-separator, #e0e0e0);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: var(--q-primary);
    box-shadow: 0 8px 24px rgba(25, 118, 210, 0.15);
    transform: translateY(-2px);
  }

  &.selected {
    border-color: var(--q-primary);
    background: linear-gradient(135deg,
      rgba(25, 118, 210, 0.08) 0%,
      rgba(25, 118, 210, 0.04) 100%
    );
    box-shadow: 0 8px 24px rgba(25, 118, 210, 0.2);

    .hour-number {
      color: var(--q-primary);
      font-weight: 600;
    }
  }

  .hour-number {
    font-size: 24px;
    font-weight: 500;
    color: var(--q-primary-text-color, #424242);
    line-height: 1;
    margin-bottom: 2px;
    transition: color 0.3s ease;
  }

  .hour-label {
    font-size: 12px;
    color: var(--q-secondary-text-color, #757575);
    font-weight: 400;
    text-transform: lowercase;
    letter-spacing: 0.02em;
  }
}

.body--dark .hour-option {
  background: var(--q-dark-background, #1a1a1a);
  border-color: var(--q-dark-separator, #424242);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

  &:hover {
    box-shadow: 0 8px 24px rgba(25, 118, 210, 0.25);
  }

  &.selected {
    background: linear-gradient(135deg,
      rgba(25, 118, 210, 0.12) 0%,
      rgba(25, 118, 210, 0.08) 100%
    );
  }

  .hour-number {
    color: var(--q-light-text, #ffffff);
  }

  .hour-label {
    color: var(--q-light-secondary-text, #b0b0b0);
  }
}

.rate-input-container {
  max-width: 400px;
  margin: 0 auto;
}

.rate-input-wrapper {
  position: relative;
}

.rate-input {
  .q-field__control {
    border-radius: 16px;
    transition: all 0.3s ease;
  }

  &.q-field--focused .q-field__control {
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
  }
}

.currency-symbol {
  font-weight: 500;
  color: var(--q-primary);
}


.document-content,
.agreement-content {
  background: var(--q-background, white);
  max-height: 400px;
  overflow-y: auto;
}

.body--dark .document-content,
.body--dark .agreement-content {
  background: var(--q-card-background, #2a2a2a);
}

.completion-section {
  max-width: 600px;
  margin: 0 auto;

  .success-icon {
    color: #4caf50;
  }
}

.error-section {
  color: #f44336;
}

.temporary-stub-section {
  max-width: 800px;
  margin: 0 auto;
  background: var(--q-light-background, #fafafa);
  border-radius: 16px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--q-separator, #e0e0e0);
}

.body--dark .temporary-stub-section {
  background: var(--q-dark-background, #1a1a1a);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.3);
  border-color: var(--q-dark-separator, #424242);
}

  .stub-content {
    padding: 40px 32px;
  }

  .stub-header {
    .stub-icon {
      opacity: 0.8;
    }

    .text-h6 {
      font-weight: 500;
      letter-spacing: -0.02em;
    }

    .text-body2 {
      font-weight: 400;
      line-height: 1.5;
    }
  }

  .stub-body {
    .text-body1 {
      line-height: 1.6;
      font-weight: 400;
    }

    .text-body2 {
      line-height: 1.5;
      font-weight: 400;


    }

    strong {
        color: var(--q-primary);
        font-weight: 500;
      }
  }

</style>
