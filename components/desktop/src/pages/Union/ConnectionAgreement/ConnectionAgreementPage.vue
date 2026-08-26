<template lang="pug">
div.row.q-pa-md
  div.col-md-12.col-xs-12

    // Лоадер пока идет загрузка данных или технические работы у провайдера
    WindowLoader(
      v-if="isLoading || connectionAgreement.isBadGateway",
      :text="connectionAgreement.isBadGateway ? 'технические работы...' : 'Загрузка данных подключения...'"
    )

    // Основной контент после загрузки (не показываем при технических работах у провайдера)
    div(v-else-if="!connectionAgreement.isBadGateway")
      div(v-if="system.info.is_providered")
        //- Показываем дашборд если установка завершена и мы на основной странице
        div(v-if="isInstallationCompleted && !isOnCompletionRoute").relative
          ConnectionDashboard

        //- Показываем степпер если идет процесс подключения
        ConnectionAgreementStepper(v-else-if="!isOnCompletionRoute")
          template(#union-registration)
            MatrixRegistration(
              :hasAccount="hasMatrixAccount"
              @accountCreated="handleMatrixAccountCreated"
            )

        //- Router view для дочерних страниц (завершение установки) только на дочерних маршрутах
        router-view(v-if="isOnCompletionRoute")

      //- Провайдер к этому кооперативу не подключён: подключение начинается
      //- не здесь, а обращением в ПК ВОСХОД — поэтому пустое состояние, а не
      //- форма.
      div(v-else)
        BaseCard
          EmptyState(
            title="Подключение к кооперативной экономике"
            body="Чтобы запустить цифровой кооператив и подключить его к платформе, обратитесь в ПК ВОСХОД."
          )
            template(#icon)
              q-icon(name="hub" size="28px")
            template(#action)
              BaseButton(
                variant="primary"
                type="button"
                @click="openProviderWebsite"
              ) Перейти на сайт

</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import {
  useConnectionAgreementStore,
  CONNECTION_STEP,
  FIRST_ONBOARDING_STEP,
} from 'src/entities/ConnectionAgreement';
import { ConnectionAgreementStepper } from 'src/widgets/ConnectionAgreementStepper';
import { ConnectionDashboard } from 'src/widgets/ConnectionDashboard';
import { BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import { WindowLoader } from 'src/shared/ui/Loader';
import { Zeus } from '@coopenomics/sdk';
import { MatrixRegistration } from '../../../../extensions/chatcoop/widgets/MatrixRegistration';
import { useChatCoopChatStore } from '../../../../extensions/chatcoop/entities/ChatCoopChat/model';

const router = useRouter();
const system = useSystemStore();
const connectionAgreement = useConnectionAgreementStore();
const chatcoopStore = useChatCoopChatStore();

// Лоадер состояния
const isLoading = ref(true);

// Остановка автообновления при размонтировании компонента
let stopInstanceRefresh: (() => void) | null = null;

// Редирект теперь делает только InstallationStep.vue

// Проверка завершения установки
const isInstallationCompleted = computed(() => {
  // После загрузки данных проверяем статус установки
  if (!isLoading.value) {
    const instance = connectionAgreement.currentInstance;
    return instance?.progress === 100 && instance?.status === Zeus.InstanceStatus.ACTIVE;
  }
  return false; // Во время загрузки считаем, что установка не завершена
});

// Проверка, находимся ли мы на маршруте завершения установки
const isOnCompletionRoute = computed(() => {
  return router.currentRoute.value.name === 'installation-completed';
});

// Проверка наличия аккаунта в мессенджере
const hasMatrixAccount = computed(() => {
  return chatcoopStore.accountStatus?.hasAccount || false;
});

// Переменная для отслеживания предыдущего состояния завершения установки
let wasInstallationCompleted = false;

// Флаг для отслеживания, был ли уже показан степпер (означает, что пользователь видел процесс установки)
let hasShownStepper = false;

// Следим за завершением установки для редиректа
watch(isInstallationCompleted, (isCompleted) => {
  // Редирект только при переходе из незавершенного состояния в завершенное
  // и только если пользователь уже видел степпер (т.е. установка шла в реальном времени)
  if (isCompleted && !wasInstallationCompleted && hasShownStepper && !isOnCompletionRoute.value) {
    console.log('🎉 Установка завершена в реальном времени! → переадресация на страницу завершения')
    router.push({ name: 'installation-completed' })
  }
  wasInstallationCompleted = isCompleted
})

// Следим за показом степпера
watch(() => !isInstallationCompleted.value && !isLoading.value && !isOnCompletionRoute.value, (isShowingStepper) => {
  if (isShowingStepper) {
    hasShownStepper = true
  }
})

const openProviderWebsite = () => {
  window.open('https://цифровой-кооператив.рф', '_blank');
};

const init = async () => {
  // Инициализация имеет смысл только если провайдер доступен
  if (!system.info.is_providered) {
    isLoading.value = false;
    return;
  }

  // Запускаем автообновление инстанса каждые 30 секунд (включает начальную загрузку)
  // Ждем завершения первой загрузки, чтобы корректно определить состояние isBadGateway
  await connectionAgreement.startInstanceAutoRefresh(30000).then((stop) => {
    stopInstanceRefresh = stop;
  });

  // Инициализируем persistent store если он еще не инициализирован
  if (!connectionAgreement.isInitialized) {
    connectionAgreement.setInitialized(true);
  }

  // Загружаем статус аккаунта в мессенджере
  const accountStatus = await chatcoopStore.loadAccountStatus();
  if (accountStatus) {
    connectionAgreement.setHasMatrixAccount(accountStatus.hasAccount);
  }

  // Подтягиваем on-chain запись кооператива — её наличие означает, что
  // соглашение о подключении уже подписано (regcoop проходит только после
  // signagree). Используем как маркёр прохождения шагов 0–4.
  try {
    await connectionAgreement.reloadCooperative();
  } catch {
    // coop ещё не зарегистрирован — это валидное состояние, не падаем
  }

  const instance = connectionAgreement.currentInstance;
  const coop = connectionAgreement.coop;

  // Сначала проверяем, была ли установка уже завершена
  const isAlreadyCompleted = instance?.progress === 100 && instance?.status === Zeus.InstanceStatus.ACTIVE;
  if (isAlreadyCompleted) {
    console.log('✅ Установка уже завершена ранее, показываем дашборд');
    isLoading.value = false;
    return;
  }

  // Восстанавливаем фактический шаг по состоянию on-chain + provider.
  // Идея: каждый шаг имеет хорошо различимый внешний маркёр; при перезагрузке
  // не должно требоваться localStorage.
  let targetStep: number;

  if (coop) {
    // Соглашение точно подписано (coop появился в registrator.coops).
    if (instance && typeof instance.progress === 'number' && instance.progress > 0) {
      targetStep = CONNECTION_STEP.installation; // установка идёт
    } else if (instance?.blockchain_status === 'active') {
      targetStep = CONNECTION_STEP.installation; // совет подтвердил, провайдер вот-вот стартует
    } else if (instance?.is_delegated) {
      targetStep = CONNECTION_STEP.approval; // домен делегирован, ждём подтверждения совета
    } else {
      targetStep = CONNECTION_STEP.dns; // DNS-шаг: ждём делегирования или провайдер ещё не подхватил coop
    }
  } else if (system.info.is_unioned) {
    targetStep = CONNECTION_STEP.union; // нужна регистрация в мессенджере союза
  } else {
    targetStep = FIRST_ONBOARDING_STEP; // онбординг с первого показанного шага
  }

  connectionAgreement.setCurrentStep(targetStep);

  isLoading.value = false;
};

// Watch за изменением currentInstance для автоматического перехода между шагами
watch(
  () => connectionAgreement.currentInstance,
  (instance) => {
    // Не обрабатываем изменения если идет загрузка или есть ошибка
    if (connectionAgreement.currentInstanceLoading || connectionAgreement.currentInstanceError) {
      return;
    }

    if (!instance) return;

    const currentStep = connectionAgreement.currentStep;

    console.log('📊 Instance обновлен:', {
      step: currentStep,
      is_valid: instance.is_valid,
      is_delegated: instance.is_delegated,
      blockchain_status: instance.blockchain_status,
      progress: instance.progress,
      status: instance.status,
    });

    // Автопереходы только для шагов dns/approval/installation — остальные
    // (union/intro/profile/domain/financial/agreement) ждут ввода пользователя.
    if (currentStep === CONNECTION_STEP.dns) {
      // Шаг 5: Проверка делегирования домена.
      if (instance.is_valid && instance.is_delegated) {
        if (instance.blockchain_status === 'active') {
          console.log('✅ Домен готов и blockchain_status активен → переход к шагу 7 (installation)');
          connectionAgreement.setCurrentStep(CONNECTION_STEP.installation);
        } else {
          console.log('⏳ Домен готов, ждём подтверждения союза → переход к шагу 6 (approval)');
          connectionAgreement.setCurrentStep(CONNECTION_STEP.approval);
        }
      }
    } else if (currentStep === CONNECTION_STEP.approval) {
      // Шаг 6: Ожидание подтверждения от союза.
      if (instance.blockchain_status === 'active') {
        console.log('✅ Подтверждение получено → переход к шагу 7 (installation)');
        connectionAgreement.setCurrentStep(CONNECTION_STEP.installation);
      }
    }
    // Редирект на страницу завершения теперь делает только InstallationStep.vue
  },
  { deep: true }
);

// Lifecycle хуки
onMounted(() => {
  // Делаем инициализацию при монтировании компонента
  init();
});

onUnmounted(() => {
  // Останавливаем автообновление инстанса при размонтировании компонента
  if (stopInstanceRefresh) {
    stopInstanceRefresh();
    stopInstanceRefresh = null;
  }
});

const handleMatrixAccountCreated = () => {
  connectionAgreement.setHasMatrixAccount(true);
};
</script>
