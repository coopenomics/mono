<template lang="pug">
div.row.q-pa-md
  div.col-md-12.col-xs-12

    // Лоадер пока идет загрузка данных или технические работы у провайдера
    WindowLoader(
      v-if="isLoading || connectionAgreement.isBadGateway",
      :text="connectionAgreement.isBadGateway ? $t('union.connectionAgreementPage.maintenanceText') : $t('union.connectionAgreementPage.loadingText')"
    )

    // Основной контент после загрузки (не показываем при технических работах у провайдера)
    div(v-else-if="!connectionAgreement.isBadGateway")
      div(v-if="system.info.is_providered")
        //- Установка завершена: здесь счёт, просрочка и кошельки. Подписки и
        //- узел — соседними пунктами меню стола пайщика (26.10.2026): девять
        //- карточек одной страницей не читались.
        ConnectionOverviewPage(v-if="isInstallationCompleted && !isOnCompletionRoute")

        //- Показываем степпер если идет процесс подключения
        ConnectionAgreementStepper(v-else-if="!isOnCompletionRoute")

        //- Router view для дочерних страниц (завершение установки) только на дочерних маршрутах
        router-view(v-if="isOnCompletionRoute")

      //- Провайдер к этому кооперативу не подключён: подключение начинается
      //- не здесь, а обращением в ПК ВОСХОД — поэтому пустое состояние, а не
      //- форма.
      div(v-else)
        BaseCard
          EmptyState(
            :title="$t('union.connectionAgreementPage.emptyTitle')"
            :body="$t('union.connectionAgreementPage.emptyBody')"
          )
            template(#icon)
              q-icon(name="hub" size="28px")
            template(#action)
              BaseButton(
                variant="primary"
                type="button"
                @click="openProviderWebsite"
              ) {{ $t('union.connectionAgreementPage.goToSiteLabel') }}

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
import { BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import { WindowLoader } from 'src/shared/ui/Loader';
import { Zeus } from '@coopenomics/sdk';
import ConnectionOverviewPage from './ConnectionOverviewPage.vue';

const router = useRouter();
const system = useSystemStore();
const connectionAgreement = useConnectionAgreementStore();

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
  // i18n-ignore: URL для перехода, не текст интерфейса
  window.open('https://цифровой-кооператив.рф', '_blank');
};

const init = async () => {
  // Инициализация имеет смысл только если провайдер доступен
  if (!system.info.is_providered) {
    isLoading.value = false;
    return;
  }

  // Автообновление инстанса каждые 10 секунд (включает начальную загрузку): на шаге установки проценты не должны отставать от провайдера
  // Ждем завершения первой загрузки, чтобы корректно определить состояние isBadGateway
  await connectionAgreement.startInstanceAutoRefresh(10000).then((stop) => {
    stopInstanceRefresh = stop;
  });

  // Инициализируем persistent store если он еще не инициализирован
  if (!connectionAgreement.isInitialized) {
    connectionAgreement.setInitialized(true);
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
    // Домен проверяется раньше решения совета: совет может утвердить заявку до
    // того, как адрес направлен, а установка без направленного адреса не
    // стартует. Прежний порядок уводил перезагрузку с шага домена на
    // «Установку» с 0% (тестнет, 20.10.2026).
    if (instance && typeof instance.progress === 'number' && instance.progress > 0) {
      targetStep = CONNECTION_STEP.installation; // установка идёт
    } else if (!connectionAgreement.isDomainDelegated) {
      targetStep = CONNECTION_STEP.dns; // DNS-шаг: ждём делегирования или провайдер ещё не подхватил coop
    } else if (instance?.blockchain_status === 'active') {
      targetStep = CONNECTION_STEP.installation; // адрес направлен, совет подтвердил — провайдер стартует
    } else {
      targetStep = CONNECTION_STEP.approval; // адрес направлен, ждём подтверждения совета
    }
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

    // Автопереход по опросу — только с шага approval; шаг dns уходит дальше
    // по смене признака делегирования (наблюдатель ниже), остальные шаги
    // (union/intro/profile/domain/financial/agreement) ждут ввода пользователя.
    if (currentStep === CONNECTION_STEP.approval) {
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

// Шаг домена закрывается сам только в момент, когда адрес стал направленным.
// Открытый вручную шаг (сверить или исправить адрес) опрос провайдера не
// закрывает: иначе каждые 30 секунд он уводил на «Совет проверяет заявку».
watch(
  () => connectionAgreement.isDomainDelegated,
  (isDelegated, wasDelegated) => {
    if (!isDelegated || wasDelegated) return;
    if (connectionAgreement.currentStep !== CONNECTION_STEP.dns) return;
    const isApproved = connectionAgreement.currentInstance?.blockchain_status === 'active';
    connectionAgreement.setCurrentStep(isApproved ? CONNECTION_STEP.installation : CONNECTION_STEP.approval);
  },
);

// Lifecycle хуки
// realtime: нет источника — подключение к союзу ведёт сервер провайдера (другой узел), в ленте кооператива его нет; статус установки обновляется опросом провайдера (startInstanceAutoRefresh).
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
</script>

