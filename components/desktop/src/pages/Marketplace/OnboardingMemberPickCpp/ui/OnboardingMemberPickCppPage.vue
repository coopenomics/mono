<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { FailAlert, NotifyAlert } from 'src/shared/api';
import { useRouter } from 'vue-router';
import { KUSelector } from 'src/widgets/Marketplace/KUSelector';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useMarketplaceCartStore } from 'src/entities/MarketplaceCart';
import { useMarketplaceKUDetailsStore } from 'src/entities/MarketplaceKUDetails';
import { BaseCard, BaseButton, BaseCheckbox, BaseChip, BaseDialog } from 'src/shared/ui/base';
import { Loader } from 'src/shared/ui/Loader';
import { loadExtensionRoutes } from 'src/processes/init-installed-extensions';
import type { DigitalDocument } from 'src/shared/lib/document';
import {
  buildOnboardingOfferDocument,
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
 * Подпись: mutation `marketplaceSignOnboardingOffer` (оферта registry_id=1102,
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

// Предпросмотр оферты для ознакомления (как в SignUp/ReadStatement): по клику на
// ссылку лениво генерим персональный инстанс оферты (registry 1102) без подписи и
// показываем HTML в диалоге. Тот же инстанс затем подписываем — документ совпадает
// с прочитанным. На «Подтвердить» в диалоге галочка согласия проставляется сама.
const offerDialogOpen = ref(false);
const offerLoading = ref(false);
const offerHtml = ref('');
const offerDoc = ref<DigitalDocument | null>(null);

async function openOffer(): Promise<void> {
  offerDialogOpen.value = true;
  if (offerDoc.value) return;
  offerLoading.value = true;
  try {
    const doc = await buildOnboardingOfferDocument();
    offerDoc.value = doc;
    offerHtml.value = doc.data?.html ?? '';
  } catch (e) {
    offerDialogOpen.value = false;
    FailAlert(e);
  } finally {
    offerLoading.value = false;
  }
}

// Прочитал и подтвердил в диалоге — равнозначно простановке галочки согласия.
function confirmOfferRead(): void {
  agreed.value = true;
  offerDialogOpen.value = false;
}

// Человеческое имя выбранного КУ для чипа-подтверждения (braname не показываем).
const selectedName = computed<string>(() => {
  if (!selectedBraname.value) return '';
  const d = kuStore.details.find((x) => x.coreBraname === selectedBraname.value);
  return d?.name || d?.addressFull || '';
});

// Нужна ли подпись оферты. Если пайщик подписал её при регистрации (выбрал ЦПП
// «Стол заказов» как программу) — backend вернёт requires_gate=false, и здесь
// подпись/чекбокс НЕ показываем: пайщик уже всё подписал, нужен лишь выбор КУ.
// Председателю/тому, кто регистрировался без этой ЦПП — requires_gate=true,
// показываем согласие + подпись (тот же документ и хранилище, что при регистрации).
const requiresGate = computed(() => Boolean(state.value?.requires_gate));
// «Продолжить» доступно: КУ выбран всегда обязателен; согласие — только если
// требуется гейт (подпись).
const canContinue = computed(
  () => Boolean(selectedBraname.value) && (!requiresGate.value || agreed.value)
);

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

/**
 * Общий финал: пайщик подключён (подпись либо есть, либо только что прошла) —
 * перечитываем гранты/маршруты, фиксируем выбранный КУ как пункт выдачи и уходим
 * на стол заказчика. Скрываем форму (redirecting), чтобы не мелькнул промежуток.
 */
async function proceedToDesk(): Promise<void> {
  redirecting.value = true;
  await desktop.loadDesktop();
  await loadExtensionRoutes('market', router);
  // Фиксируем выбранный КУ как пункт выдачи корзины. Если упадёт — не блокируем
  // переход: КУ можно сменить в шапке стола.
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
}

/**
 * «Продолжить». Две равнозначные ветки одного гейта:
 *  - requires_gate=true  → пайщик ещё не подписывал оферту (напр. председатель,
 *    регистрировавшийся без этой ЦПП): подписываем здесь (тот же документ 1102 и
 *    то же ончейн-хранилище wallet::users.programs, что и при регистрации);
 *  - requires_gate=false → подписал при регистрации: подпись не нужна, лишь
 *    фиксируем выбранный КУ и уходим на стол.
 */
async function onContinue(): Promise<void> {
  if (!canContinue.value) return;
  if (requiresGate.value) {
    await onSign();
    return;
  }
  loading.value = true;
  try {
    await proceedToDesk();
  } catch (e) {
    redirecting.value = false;
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

async function onSign(): Promise<void> {
  if (!selectedBraname.value || !agreed.value) return;
  // Только loading: спиннер на кнопке + блокировка формы (см. шаблон), без
  // full-screen оверлея. Форма остаётся видимой, пока идёт подпись.
  loading.value = true;
  try {
    // Передаём уже прочитанный инстанс оферты (если был сгенерирован при
    // ознакомлении), иначе signOnboardingOffer сгенерирует свежий.
    state.value = await signOnboardingOffer(offerDoc.value ?? undefined);
    // requires_gate=false сразу — редкий случай (PG уже синхронен); иначе ждём
    // синк подписи в PG коротким поллингом.
    const confirmed =
      (!!state.value && !state.value.requires_gate) || (await waitForSignatureSynced());
    if (confirmed) {
      await proceedToDesk();
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

onMounted(load);
</script>

<template lang="pug">
q-page.mp-role-orderer.mp-member-cpp(role="region", aria-label="Подключение к Столу заказов")
  //- Спиннер на весь экран — ТОЛЬКО на первичной загрузке состояния и на короткой
  //- фазе перехода (redirecting, после подтверждения подписи). На самой подписи
  //- (поллинг синка ~15с) оверлея НЕТ — спиннер на кнопке + блокировка полей.
  q-inner-loading(:showing="(loading && !state) || redirecting")
    q-spinner(color="primary", size="2em")

  //- Подключение к столу: карточка выбора пункта выдачи (с картой) показывается
  //- ВСЕГДА. Липкий нижний бар: согласие+подпись — только если requires_gate
  //- (пайщик ещё не подписывал оферту). Если подписал при регистрации —
  //- requires_gate=false: только выбор КУ, без подписи. Пока идёт переход
  //- (redirecting) — скрыто (один спиннер).
  template(v-if="state && !redirecting")
    BaseCard.mp-member-cpp__card
      header.mp-member-cpp__head
        .mp-member-cpp__head-icon
          q-icon(name="location_on", size="22px")
        .mp-member-cpp__head-text
          .text-subtitle1.text-weight-medium Выберите пункт выдачи заказов
          .text-body2.text-grey-7 Выбирайте участок, где вам удобно забирать заказы, — сменить его можно в любой момент.
        BaseChip.mp-member-cpp__picked(v-if="selectedName", variant="pos", size="sm")
          q-icon(name="check", size="14px")
          | {{ selectedName }}
      .mp-member-cpp__selector(:class="{ 'mp-member-cpp__selector--busy': loading }")
        KUSelector(v-model="selectedBraname", :coopname="coopname")

    //- Липкий нижний бар: согласие (только при requires_gate) + продолжение.
    //- Ссылка в подписи генерит оферту для ознакомления (как ReadStatement в SignUp).
    .mp-member-cpp__bar
      BaseCheckbox.mp-member-cpp__consent(
        v-if="requiresGate",
        :model-value="agreed",
        block,
        :disabled="loading",
        @update:model-value="(v) => (agreed = v)"
      )
        | Я ознакомлен(а) с&nbsp;
        span.mp-member-cpp__offer-link(@click.stop="openOffer") офертой на присоединение к ЦПП «Стол заказов» и Положением ЦПП
        |  и согласен(на) с условиями участия.
      //- Уже подписал при регистрации — подпись не нужна, лишь выбор КУ.
      .mp-member-cpp__consent.text-body2.text-grey-7(v-else)
        | Оферта ЦПП «Стол заказов» уже подписана при регистрации — выберите пункт выдачи, чтобы продолжить.
      .mp-member-cpp__action
        BaseButton.mp-member-cpp__sign(
          variant="primary",
          :loading="loading",
          :disabled="!canContinue",
          @click="onContinue"
        ) Продолжить
        //- Подсказка-зачем кнопка неактивна: согласие (если нужно) есть, но ПВЗ не выбран.
        .mp-member-cpp__why(v-if="(!requiresGate || agreed) && !selectedBraname")
          q-icon(name="info", size="14px")
          span Чтобы продолжить, выберите пункт выдачи — щёлкните по его названию или адресу в списке либо отметьте точку на карте.

  //- Диалог ознакомления: сгенерированный HTML оферты. «Подтвердить» = согласие.
  BaseDialog(
    v-model="offerDialogOpen",
    title="Оферта на присоединение к ЦПП «Стол заказов»",
    :maximized="true"
  )
    .mp-member-cpp__offer-body
      Loader(v-if="offerLoading", text="Генерируем оферту…")
      //- eslint-disable-next-line vue/no-v-html
      div(v-else, v-html="offerHtml").statement
    template(#footer)
      BaseButton(variant="ghost", @click="offerDialogOpen = false") Закрыть
      BaseButton(variant="primary", :disabled="offerLoading", @click="confirmOfferRead") Прочитал(а), согласен(на)
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
    align-items: flex-start;
    gap: var(--p-4, 16px);
    margin: 0 calc(-1 * var(--p-6, 24px)) calc(-1 * var(--p-10, 72px));
    padding: var(--p-4, 16px) var(--p-6, 24px);
    background: var(--p-canvas);
    border-top: 1px solid var(--p-line);
  }

  // Правая колонка бара: кнопка «Продолжить» + подсказка-зачем под ней.
  &__action {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--p-2, 8px);
    max-width: 320px;
  }

  // Подсказка, почему «Продолжить» недоступно (нет выбранного ПВЗ).
  &__why {
    display: flex;
    align-items: flex-start;
    gap: var(--p-1, 4px);
    color: var(--p-ink-2);
    font-size: var(--p-fs-body-sm, 13px);
    line-height: 1.4;
    text-align: right;

    .q-icon {
      flex-shrink: 0;
      margin-top: 2px;
      color: var(--p-info, var(--p-primary));
    }
  }

  // Тело оферты в диалоге — читаемая колонка по центру, не во всю ширину экрана.
  &__offer-body {
    max-width: 840px;
    margin: 0 auto;
  }

  &__consent {
    flex: 1;
    min-width: 0;
  }

  // Ссылка «офертой… Положением ЦПП» в подписи согласия — открывает диалог
  // ознакомления. Акцентная, как ссылки-идентификаторы в каноне.
  &__offer-link {
    color: var(--p-accent);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;

    &:hover {
      color: var(--p-primary);
    }
  }

  &__sign {
    flex-shrink: 0;
  }

  // HTML оферты в диалоге приходит сгенерированным с backend (inline-стили,
  // Quasar text-h*); подгоняем под канон-типографику.
  .statement {
    color: var(--p-ink);
    font-size: var(--p-fs-body, 14px);
    line-height: var(--p-lh-body, 1.55);

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(.text-h1),
    :deep(.text-h2),
    :deep(.text-h3),
    :deep(.text-h4) {
      font-weight: 600 !important;
      color: var(--p-ink) !important;
      letter-spacing: 0 !important;
    }
    :deep(p) {
      margin: 0 0 var(--p-3, 12px) !important;
      color: var(--p-ink) !important;
    }
    :deep(a) {
      color: var(--p-primary);
      text-decoration: none;
    }
    :deep(table) {
      width: 100%;
      border-collapse: collapse;
      margin: var(--p-3, 12px) 0;
      font-size: var(--p-fs-body-sm, 13px);
    }
    :deep(td),
    :deep(th) {
      padding: var(--p-2, 8px) var(--p-3, 12px);
      border-bottom: 1px solid var(--p-line);
      vertical-align: top;
    }
  }

  @media (max-width: 768px) {
    &__bar {
      flex-direction: column;
      align-items: stretch;
      gap: var(--p-3, 12px);
    }

    &__action {
      max-width: none;
      align-items: stretch;
    }

    &__sign {
      width: 100%;
    }

    &__why {
      text-align: left;
    }
  }
}
</style>
