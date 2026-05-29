<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { Notify } from 'quasar';
import { useRouter } from 'vue-router';
import {
  OnboardingCPPGate,
  type CPPDocument,
} from 'src/widgets/Marketplace/OnboardingCPPGate';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { loadExtensionRoutes } from 'src/processes/init-installed-extensions';
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
const desktop = useDesktopStore();
const system = useSystemStore();

// Единственный подписываемый документ — оферта на присоединение к ЦПП.
// Положение ЦПП сюда отдельной подписью не выносится: это статический документ
// для ознакомления (принимается кооперативом на L1), оферта на него ссылается.
const cppDocuments = computed<CPPDocument[]>(() => {
  if (!state.value) return [];
  return [
    {
      id: 'cpp-marketplace-offer',
      title: 'Оферта на присоединение к ЦПП «Стол заказов»',
      description: 'Заявление о присоединении к программе с условиями участия.',
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

/**
 * После подписи `wallet::signagree` уже подтверждён цепочкой (мутация
 * вернулась), но `requires_gate` и гранты завязаны на PG-кеш `wallet::users`,
 * который parser синхронизирует со следующего блока. Коротко поллим состояние
 * онбординга, пока подпись не отразится в PG, — тогда и `getDesktop` отдаст
 * полные orderer-права. Так переключение происходит само, без ручного refresh
 * (и без поллинга на каждом переходе — только здесь, разово после подписи).
 */
async function waitForSignatureSynced(): Promise<boolean> {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    state.value = await fetchOnboardingState();
    if (state.value && !state.value.requires_gate) return true;
  }
  return false;
}

async function onAccept(_documentIds: string[]): Promise<void> {
  // L3 подпись прямо со стола: mutation `marketplaceSignOnboardingOffer`.
  // Frontend рендерит оферту 1101 через documentFactory, подписывает локальным
  // WIF, отправляет на backend, а тот вызывает on-chain `wallet::signagree` от
  // лица coopname (программная подпись в wallet::users.programs[], program_id=2).
  loading.value = true;
  try {
    state.value = await signOnboardingOffer();
    // requires_gate=false сразу — редкий случай (PG уже синхронен); иначе ждём
    // синк подписи в PG коротким поллингом.
    const confirmed =
      (!!state.value && !state.value.requires_gate) || (await waitForSignatureSynced());
    if (confirmed) {
      Notify.create({
        type: 'positive',
        message: 'Оферта ЦПП «Стол заказов» подписана. Открываем стол заказчика…',
        timeout: 1500,
      });
      // Подпись синхронизирована: backend теперь выдаёт полные orderer-права
      // вместо маркера Onboarding:orderer. Перечитываем десктоп (гранты) и
      // переустанавливаем маршруты, затем ведём на первую доступную страницу
      // стола (Каталог) — тот же канон refresh, что у EnableButton.
      await desktop.loadDesktop();
      await loadExtensionRoutes('market', router);
      const coopname = system.info?.coopname;
      const target = desktop.firstAccessibleRoute('market');
      void router.push(
        target
          ? coopname
            ? { name: target.name, params: { coopname } }
            : { name: target.name }
          : { name: 'marketplace-catalog' },
      );
    } else {
      // Синк не успел за отведённое окно — крайне редко; даём пользователю
      // явный сигнал перезагрузить страницу.
      Notify.create({
        type: 'info',
        message: 'Подпись принята блокчейном и синхронизируется. Обновите страницу через несколько секунд.',
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
q-page.mp-role-orderer.mp-member-cpp(role="region", aria-label="Подключение к Столу заказов")
  q-inner-loading(:showing="loading && !state")
    q-spinner(color="primary", size="2em")

  q-banner(v-if="alreadyDone", rounded, class="bg-positive text-white q-mt-md")
    template(#avatar)
      q-icon(name="fa-solid fa-circle-check", color="white")
    div.text-subtitle2 Вы уже подключены к Столу заказов
    div.text-body2
      | Подпись ЦПП Стола заказов уже выполнена.
      template(v-if="state?.completed_at")
        |  Дата: {{ state.completed_at }}.
      |  Можете переходить на стол заказчика.
    template(#action)
      q-btn(flat, color="white", label="К каталогу", @click="router.push({ name: 'marketplace-catalog' })")

  OnboardingCPPGate(
    v-if="state && state.requires_gate && cppDocuments.length",
    title="Присоединение к Столу заказов",
    subtitle="Подключение пайщика к программе",
    lead-text="Ознакомьтесь с Положением ЦПП «Стол заказов» и подпишите оферту на присоединение. При нажатии «Подписать оферту» документ будет подписан вашим электронным ключом и отправлен в блокчейн.",
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
