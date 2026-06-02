<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert, NotifyAlert } from 'src/shared/api';
import { useRouter } from 'vue-router';
import { KUSelector } from 'src/widgets/Marketplace/KUSelector';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { BaseCard, BaseButton, BaseCheckbox, BaseChip, EmptyState } from 'src/shared/ui/base';
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
const kuStore = useMarketplaceKUDetailsStore();

// Выбранный при присоединении КУ + согласие с офертой — оба обязательны.
const selectedBraname = ref<string | null>(null);
const agreed = ref(false);
const coopname = computed(() => system.info?.coopname ?? '');

// Человеческое имя выбранного КУ для чипа-подтверждения (braname не показываем).
const selectedName = computed<string>(() => {
  if (!selectedBraname.value) return '';
  const d = kuStore.details.find((x) => x.coreBraname === selectedBraname.value);
  return d?.name || d?.addressFull || '';
});

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
  // Только loading: спиннер на кнопке + блокировка формы (см. шаблон), без
  // full-screen оверлея. Форма остаётся видимой, пока идёт подпись.
  loading.value = true;
  try {
    state.value = await signOnboardingOffer();
    // requires_gate=false сразу — редкий случай (PG уже синхронен); иначе ждём
    // синк подписи в PG коротким поллингом.
    const confirmed =
      (!!state.value && !state.value.requires_gate) || (await waitForSignatureSynced());
    if (confirmed) {
      // Подписано и синхронизировано — прячем форму перед редиректом, чтобы не
      // мелькнул промежуточный экран-поздравление.
      redirecting.value = true;
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

function goToCatalog(): void {
  void router.push({ name: 'marketplace-catalog' });
}

onMounted(load);
</script>

<template lang="pug">
q-page.mp-role-orderer.mp-member-cpp(role="region", aria-label="Подключение к Столу заказов")
  //- Спиннер на весь экран — ТОЛЬКО на первичной загрузке состояния и на короткой
  //- фазе перехода (redirecting, после подтверждения подписи). На самой подписи
  //- (поллинг синка ~15с) оверлея НЕТ — спиннер на кнопке + блокировка полей.
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

  //- Присоединение: интро-подсказка, карточка выбора пункта выдачи (с картой) и
  //- липкий нижний бар (согласие + подпись). Пока идёт подписание (redirecting)
  //- — скрыто (один спиннер на кнопке).
  template(v-if="state && state.requires_gate && !redirecting")
    //- Канон-подсказка с заголовком и пояснением (не одна серая строка).
    .banner.banner--info
      q-icon.banner__icon(name="storefront", size="20px")
      .banner__body
        .text-weight-medium Подключение к Столу заказов
        .text-body2.text-grey-7 Выберите кооперативный участок и подпишите оферту — после этого откроется каталог с товарами, которые возят на ваш участок.

    BaseCard.mp-member-cpp__card
      header.mp-member-cpp__head
        .mp-member-cpp__head-icon
          q-icon(name="location_on", size="22px")
        .mp-member-cpp__head-text
          .text-subtitle1.text-weight-medium Пункт выдачи
          .text-body2.text-grey-7 Где будете забирать заказы. Каталог отфильтруется под выбранный участок.
        BaseChip.mp-member-cpp__picked(v-if="selectedName", variant="pos", size="sm")
          q-icon(name="check", size="14px")
          | {{ selectedName }}
      .mp-member-cpp__selector(:class="{ 'mp-member-cpp__selector--busy': loading }")
        KUSelector(v-model="selectedBraname", :coopname="coopname")

    //- Липкий нижний бар: согласие + подпись (канон — навигация формы у низа).
    .mp-member-cpp__bar
      BaseCheckbox.mp-member-cpp__consent(
        :model-value="agreed",
        block,
        :disabled="loading",
        @update:model-value="(v) => (agreed = v)"
      )
        | Я ознакомлен(а) с офертой на присоединение к ЦПП «Стол заказов» и Положением ЦПП и согласен(на) с условиями участия.
      BaseButton.mp-member-cpp__sign(
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
  // Снизу — место под липкий бар, чтобы он не накрывал контент карты.
  padding-bottom: var(--p-10, 72px);
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  // Во всю ширину стола (как каталог/таблицы) — внутри карта пунктов выдачи,
  // ей нужна вся доступная ширина.

  // Вертикальный ритм внутри карточки выбора КУ.
  &__card :deep(.base-card__body) {
    display: flex;
    flex-direction: column;
    gap: var(--p-4, 16px);
  }

  // Шапка карточки: teal icon-tile + заголовок/подзаголовок + чип выбранного КУ.
  &__head {
    display: flex;
    align-items: center;
    gap: var(--p-3, 12px);
  }

  &__head-icon {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: var(--p-r-md, 12px);
    background: var(--p-primary-soft);
    color: var(--p-primary);
  }

  &__head-text {
    flex: 1;
    min-width: 0;
  }

  &__picked {
    align-self: center;

    .q-icon {
      margin-right: var(--p-1, 4px);
    }
  }

  // Стабильная высота области выбора (карта 480px) — меньше «прыжков» при
  // асинхронной загрузке участков/карты.
  &__selector {
    min-height: 480px;

    // Во время подписи блокируем смену КУ (спиннер на кнопке, без оверлея).
    &--busy {
      pointer-events: none;
      opacity: 0.6;
    }
  }

  // Липкий нижний бар: согласие слева (тянется), подпись справа. Full-bleed к
  // краям страницы и прибит к низу вьюпорта — всегда на виду (канон формы).
  &__bar {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: var(--p-4, 16px);
    margin: 0 calc(-1 * var(--p-6, 24px)) calc(-1 * var(--p-10, 72px));
    padding: var(--p-4, 16px) var(--p-6, 24px);
    background: var(--p-canvas);
    border-top: 1px solid var(--p-line);
  }

  &__consent {
    flex: 1;
    min-width: 0;
  }

  &__sign {
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    &__bar {
      flex-direction: column;
      align-items: stretch;
      gap: var(--p-3, 12px);
    }

    &__sign {
      width: 100%;
    }
  }
}
</style>
