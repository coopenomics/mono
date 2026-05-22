<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Notify } from 'quasar';
import { useRouter } from 'vue-router';
import {
  OnboardingCPPGate,
  type CPPDocument,
} from 'src/widgets/Marketplace/OnboardingCPPGate';
import {
  fetchOnboardingState,
  signOnboardingOffer,
  type MarketplaceOnboardingStateView,
} from '../api';

/**
 * Эпик 1 / Story 1.4 + 1.11: L3 онбординг пайщика — Marketplace gate.
 *
 * Пайщик попадает сюда, когда `marketplaceOnboardingState.requires_gate === true`
 * (см. routing guard /market/*). На странице — canon `OnboardingCPPGate`
 * (UX-DR17) со списком документов ЦПП «Стол заказов»: оферта на присоединение
 * + Положение ЦПП. Подпись делает core `wallet::signagree` через
 * Registrator мастер (платформенный поток, не marketplace).
 *
 * UI здесь — информационный layer: показывает документы, ведёт пользователя
 * в Registrator. После подписи backend пересчитает `requires_gate=false` и
 * пайщик попадёт на /market.
 *
 * Зачем отдельная страница, а не только gate-overlay: чтобы у пайщика была
 * прямая ссылка из навигации/уведомлений «подключиться к Marketplace».
 */

const state = ref<MarketplaceOnboardingStateView | null>(null);
const loading = ref(false);
const router = useRouter();

const cppDocuments = computed<CPPDocument[]>(() => {
  if (!state.value) return [];
  return [
    {
      id: 'cpp-marketplace-offer',
      title: 'Оферта на присоединение к ЦПП «Стол заказов»',
      description: `Шаблон документа № ${state.value.template_registry_id} в реестре кооператива.`,
      required: true,
      locked: false,
    },
    {
      id: 'cpp-marketplace-rules',
      title: 'Положение ЦПП «Стол заказов»',
      description: 'Правила взаимодействия заказчиков, поставщиков и ПВЗ.',
      required: true,
      locked: false,
    },
  ];
});

const alreadyDone = computed(() => state.value && !state.value.requires_gate);

async function load(): Promise<void> {
  loading.value = true;
  try {
    state.value = await fetchOnboardingState();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

async function onAccept(_documentIds: string[]): Promise<void> {
  // L3 подпись прямо со стола: фоллоуап Эпика 1 (mutation
  // `marketplaceSignOnboardingOffer`). Frontend рендерит оферту 1101 через
  // documentFactory, подписывает локальным WIF, отправляет на backend, а тот
  // вызывает on-chain `wallet::signagree` от лица coopname.
  // После успешной подписи перезагружаем состояние онбординга — если
  // requires_gate=false, ведём пайщика на каталог.
  loading.value = true;
  try {
    state.value = await signOnboardingOffer();
    if (state.value && !state.value.requires_gate) {
      Notify.create({
        type: 'positive',
        message: 'Оферта ЦПП «Стол заказов» подписана. Открываем каталог…',
        timeout: 1500,
      });
      setTimeout(() => {
        void router.push({ name: 'marketplace-catalog' });
      }, 800);
    } else {
      // Sync ещё не подтянул запись из chain — даём UI шанс перезапросить
      // вручную через перезагрузку страницы.
      Notify.create({
        type: 'info',
        message: 'Подпись отправлена. Подтверждение из блокчейна ожидается — обновите страницу через несколько секунд.',
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    Notify.create({ type: 'negative', message });
  } finally {
    loading.value = false;
  }
}

function onDecline(): void {
  Notify.create({
    type: 'warning',
    message: 'Без подписи ЦПП Стол заказов недоступен. Вернитесь, когда будете готовы.',
  });
  void router.push({ name: 'wallet' });
}

onMounted(load);
</script>

<template lang="pug">
q-page.mp-role-orderer.mp-member-cpp(role="region", aria-label="Подключение к Marketplace")
  div.text-h5 Подключение к Столу заказов

  q-inner-loading(:showing="loading && !state")
    q-spinner(color="primary", size="2em")

  q-banner(v-if="alreadyDone", rounded, class="bg-positive text-white q-mt-md")
    template(#avatar)
      q-icon(name="fa-solid fa-circle-check", color="white")
    div.text-subtitle2 Вы уже подключены к Marketplace
    div.text-body2
      | Подпись ЦПП Стола заказов уже выполнена.
      template(v-if="state?.completed_at")
        |  Дата: {{ state.completed_at }}.
      |  Можете переходить на стол заказчика.
    template(#action)
      q-btn(flat, color="white", label="К каталогу", @click="router.push({ name: 'marketplace-catalog' })")

  OnboardingCPPGate(
    v-if="state && state.requires_gate && cppDocuments.length",
    title="Стол заказов — пакет ЦПП",
    subtitle="Эпик 1 / L3 онбординг пайщика",
    lead-text="Ознакомьтесь с офертой и Положением ЦПП «Стол заказов». При нажатии «Подписать» документ будет подписан вашим электронным ключом и отправлен в блокчейн.",
    :documents="cppDocuments",
    confirm-label="Подписать оферту"
    :busy="loading",
    @accept="onAccept",
    @decline="onDecline"
  )

  q-banner(v-if="state && !state.requires_gate && !alreadyDone", rounded, class="bg-grey-3 q-mt-md")
    div.text-body2 Состояние онбординга получено, но gate не требуется и подпись не зафиксирована — возможен временный рассинхрон. Обновите страницу.
</template>

<style scoped lang="scss">
.mp-member-cpp {
  padding: var(--mp-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);
  max-width: 760px;
}
</style>
