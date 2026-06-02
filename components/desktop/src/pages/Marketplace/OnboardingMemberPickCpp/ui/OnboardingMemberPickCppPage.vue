<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert, NotifyAlert } from 'src/shared/api';
import { useRouter } from 'vue-router';
import { KUSelector } from 'src/widgets/Marketplace/KUSelector';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { BaseCard, BaseButton, BaseCheckbox, EmptyState } from 'src/shared/ui/base';
import { loadExtensionRoutes } from 'src/processes/init-installed-extensions';
import {
  fetchOnboardingState,
  signOnboardingOffer,
  type MarketplaceOnboardingStateView,
} from '../api';

/**
 * Эпик 1 / Story 1.4 + 1.11: L3 онбординг пайщика — присоединение к Столу заказов.
 *
 * ЕДИНАЯ карточка-шаг (не два разрозненных блока): сверху — выбор пункта выдачи
 * (КУ) со списком и картой, под ним во всю ширину — согласие с офертой и кнопка
 * подписи. КУ выбирается ДО подписи (held локально), подпись без выбранного КУ
 * и без согласия заблокирована. Persist КУ в корзину (`setCartDeliveryPoint`)
 * делаем СРАЗУ после синка подписи — до неё нет orderer-прав на Cart.
 *
 * Подпись: mutation `marketplaceSignOnboardingOffer` (оферта registry_id=1101,
 * подписывается локальным WIF, backend выполняет on-chain `wallet::signagree`).
 */

const state = ref<MarketplaceOnboardingStateView | null>(null);
const loading = ref(false);
// Идёт подписание + переход на стол заказчика. Пока true — прячем форму и
// держим спиннер, чтобы между скрытием формы и редиректом не мелькал
// промежуточный экран-поздравление (пользователь явно не хочет его).
const redirecting = ref(false);
const router = useRouter();
const desktop = useDesktopStore();
const system = useSystemStore();
const cartStore = useMarketplaceCartStore();

// Выбранный при присоединении КУ + согласие с офертой — оба обязательны.
const selectedBraname = ref<string | null>(null);
const agreed = ref(false);
const coopname = computed(() => system.info?.coopname ?? '');

const canSign = computed(() => Boolean(selectedBraname.value) && agreed.value);
const alreadyDone = computed(() => state.value && !state.value.requires_gate);

async function load(): Promise<void> {
  loading.value = true;
  try {
    state.value = await fetchOnboardingState();
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

/**
 * После подписи `wallet::signagree` уже подтверждён цепочкой (мутация
 * вернулась), но `requires_gate` и гранты завязаны на PG-кеш `wallet::users`,
 * который parser синхронизирует со следующего блока. Коротко поллим состояние
 * онбординга, пока подпись не отразится в PG, — тогда и `getDesktop` отдаст
 * полные orderer-права. Так переключение происходит само, без ручного refresh.
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

async function onSign(): Promise<void> {
  if (!canSign.value) return;
  loading.value = true;
  // Сразу прячем форму: подписал → ведём на стол заказчика без промежуточного
  // экрана-поздравления.
  redirecting.value = true;
  try {
    state.value = await signOnboardingOffer();
    // requires_gate=false сразу — редкий случай (PG уже синхронен); иначе ждём
    // синк подписи в PG коротким поллингом.
    const confirmed =
      (!!state.value && !state.value.requires_gate) || (await waitForSignatureSynced());
    if (confirmed) {
      // Подпись синхронизирована: backend теперь выдаёт полные orderer-права.
      // Перечитываем десктоп (гранты) и переустанавливаем маршруты.
      await desktop.loadDesktop();
      await loadExtensionRoutes('market', router);
      // Теперь у пайщика есть orderer-права на Cart — фиксируем выбранный КУ как
      // пункт выдачи корзины. Каталог откроется уже отфильтрованным под него.
      // Если шаг упадёт — не блокируем переход: КУ можно сменить в шапке стола.
      if (selectedBraname.value) {
        try {
          await cartStore.changeDeliveryPoint(selectedBraname.value);
        } catch (e) {
          console.warn('[OnboardingMemberPickCpp] setCartDeliveryPoint упал:', e);
        }
      }
      const target = desktop.firstAccessibleRoute('market');
      void router.push(
        target
          ? coopname.value
            ? { name: target.name, params: { coopname: coopname.value } }
            : { name: target.name }
          : { name: 'marketplace-catalog' },
      );
    } else {
      // Синк не успел за отведённое окно — крайне редко; даём пользователю
      // явный сигнал перезагрузить страницу.
      redirecting.value = false;
      NotifyAlert('Подпись принята блокчейном и синхронизируется. Обновите страницу через несколько секунд.');
    }
  } catch (e) {
    redirecting.value = false;
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onDecline(): void {
  NotifyAlert('Без подписи ЦПП Стол заказов недоступен. Вернитесь, когда будете готовы.');
  void router.push({ name: 'wallet' });
}

function goToCatalog(): void {
  void router.push({ name: 'marketplace-catalog' });
}

onMounted(load);
</script>

<template lang="pug">
q-page.mp-role-orderer.mp-member-cpp(role="region", aria-label="Подключение к Столу заказов")
  q-inner-loading(:showing="(loading && !state) || redirecting")
    q-spinner(color="primary", size="2em")

  //- Уже подключён — поздравление-состояние (канон EmptyState), без формы.
  EmptyState(
    v-if="alreadyDone && !redirecting",
    title="Вы уже подключены к Столу заказов",
    body="Подпись ЦПП «Стол заказов» уже выполнена. Можно переходить на стол заказчика."
  )
    template(#icon)
      q-icon(name="check_circle", color="positive", size="48px")
    template(#actions)
      BaseButton(variant="primary", @click="goToCatalog") К каталогу

  //- Единая карточка присоединения: выбор КУ + карта, под ними — согласие и
  //- подпись. Пока идёт подписание (redirecting) — скрыта (один спиннер).
  BaseCard.mp-member-cpp__card(v-if="state && state.requires_gate && !redirecting")
    .mp-member-cpp__lead
      | Чтобы подключиться к Столу заказов, выберите удобный пункт выдачи и
      | подпишите оферту на присоединение.

    section.mp-member-cpp__section
      .text-subtitle1.text-weight-medium Пункт выдачи (КУ)
      .text-caption.text-grey-7.mp-member-cpp__hint
        | Где вам удобно получать заказы. После подключения каталог откроется с
        | товарами, которые возят на выбранный участок — пункт можно сменить в
        | шапке стола.
      KUSelector(v-model="selectedBraname", :coopname="coopname")

    q-separator.mp-member-cpp__sep

    section.mp-member-cpp__consent
      BaseCheckbox(:model-value="agreed", block, @update:model-value="(v) => (agreed = v)")
        | Я ознакомлен(а) с офертой на присоединение к ЦПП «Стол заказов» и Положением ЦПП и согласен(на) с условиями участия.
      .text-caption.text-grey-7.mp-member-cpp__consent-hint
        | Подпись оферты обязательна для подключения. Документ будет подписан
        | вашим электронным ключом и отправлен в блокчейн.

    .mp-member-cpp__actions
      BaseButton(variant="ghost", :disabled="loading", @click="onDecline") Отказаться
      BaseButton(
        variant="primary",
        :loading="loading",
        :disabled="!canSign",
        @click="onSign"
      ) Подписать оферту

  //- Редкий рассинхрон: gate не требуется, но подпись не зафиксирована.
  BaseCard.mp-member-cpp__card(
    v-if="state && !state.requires_gate && !alreadyDone",
    variant="quiet"
  )
    .text-body2.text-grey-7
      | Состояние онбординга получено, но подпись пока не зафиксирована — возможен
      | временный рассинхрон. Обновите страницу через несколько секунд.
</template>

<style scoped lang="scss">
.mp-member-cpp {
  padding: var(--p-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  // Шире обычной формы: внутри карта пунктов выдачи (список + карта рядом).
  max-width: 1080px;

  // Единый вертикальный ритм внутри карточки.
  &__card :deep(.base-card__body) {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  &__lead {
    font-size: var(--p-fs-body, 14px);
    color: var(--p-ink-2);
  }

  &__section {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__hint {
    margin-bottom: var(--p-2, 8px);
  }

  &__sep {
    background: var(--p-line);
  }

  &__consent {
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }

  &__consent-hint {
    padding-left: calc(18px + var(--p-2, 8px));
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--p-2, 8px);
    padding-top: var(--p-2, 8px);
    border-top: 1px solid var(--p-line);
  }
}
</style>
