<template lang="pug">
.cardcoop-page
  //- Заголовок и подсказка страницы не дублируются: заголовок уже в шапке, главное
  //- действие («Выпустить карту» / «Открыть карту») тоже там (канон стола).
  BaseCard
    //- Пока состояние едет с сервера, на его месте каркас той же формы: спиннер поверх
    //- содержимого дёргает экран, а «карта не выпущена» на секунду читается как ответ.
    .card-layout(v-if='loading')
      q-skeleton.card-layout__visual(type='rect', height='224px')
      .card-layout__rows
        DataRow(:label='$t("user.cardcoopPage.cardNumberLabel")')
          template(#value-override)
            q-skeleton(type='text', width='180px')
        DataRow(:label='$t("user.cardcoopPage.membershipLabel")')
          template(#value-override)
            q-skeleton(type='QChip', width='160px')
        DataRow(:label='$t("user.cardcoopPage.memberSinceLabel")')
          template(#value-override)
            q-skeleton(type='text', width='96px')

    .card-layout(v-else-if='card?.issued')
      //- Сама карта: изображение членского билета сети, как в кабинете card.coop
      //- (решение владельца 03.09.2026). Остальное на странице плоское — карта
      //- единственный объём, потому что человек пришёл увидеть именно её.
      .card-layout__visual
        .member-card
          .member-card__row
            span.member-card__brand CARD.COOP
            span.member-card__seal(v-if='seal', aria-hidden='true') {{ seal }}
          .member-card__number {{ formattedNumber }}
          .member-card__foot
            div
              .member-card__cap {{ $t('user.cardcoopPage.holderCaption') }}
              .member-card__val {{ holderName || $t('user.cardcoopPage.defaultHolderName') }}
            .member-card__right
              .member-card__cap {{ $t('user.cardcoopPage.coopCaption') }}
              .member-card__val {{ coopName }}

      .card-layout__rows
        DataRow(
          v-if='card.cardNumber',
          :label='$t("user.cardcoopPage.cardNumberLabel")',
          :value='formattedNumber',
          mono,
          copyable
        )
        DataRow(:label='$t("user.cardcoopPage.membershipLabel")')
          template(#value-override)
            BaseChip(:variant='status.variant') {{ status.label }}
        DataRow(
          v-if='card.memberSince',
          :label='$t("user.cardcoopPage.memberSinceLabel")',
          :value='formatDocumentDate(card.memberSince)'
        )
        DataRow(:label='$t("user.cardcoopPage.networkLabel")', :value='networkHost')

    EmptyState(
      v-else,
      :title='$t("user.cardcoopPage.emptyTitle")',
      :body='$t("user.cardcoopPage.emptyBody")'
    )
      template(#icon)
        q-icon(name='badge', size='28px')

  //- Для чего карта — отдельной карточкой, а не подсказкой: страница без объяснения
  //- была почти пустой, и человек не понимал, что за карта и зачем её выпускать.
  BaseCard(:title='$t("user.cardcoopPage.purposeTitle")')
    .purpose
      p.purpose__lead
        | {{ $t('user.cardcoopPage.purposeLeadLine1') }}
        | {{ $t('user.cardcoopPage.purposeLeadLine2') }}
      .purpose__items
        .purpose__item(v-for='item in PURPOSE', :key='item.title')
          q-icon.purpose__icon(:name='item.icon', size='22px')
          div
            .purpose__title {{ item.title }}
            .purpose__text {{ item.text }}
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { BaseCard, BaseChip, EmptyState } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { useHeaderActions } from 'src/shared/hooks';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { cardcoopCardApi, type ICardcoopCard } from 'src/entities/CardcoopCard';
import { useDisplayName } from 'src/shared/lib/composables/useDisplayName';
import { formatDocumentDate } from 'src/shared/lib/utils/dates';
import type { BaseChipVariant } from 'src/shared/ui/base/BaseChip/BaseChip.types';
import { cardcoopHeaderState } from '../model/header';
import CardcoopHeaderActions from './CardcoopHeaderActions.vue';
import { t } from 'src/shared/i18n';

/**
 * Карта кооператора в столе кооператива (story 7.4 / 3B5-32, FR-E4).
 *
 * Главный вход в выпуск карты: человек уже аутентифицирован в кооперативе, и ему остаётся
 * один переход. Состояние берётся из журнала самого кооператива, а не из сети, — стол
 * обязан работать, когда card.coop недоступен (NFR-3). Кнопка выпуска/открытия — в шапке
 * страницы (решение владельца 02.09.2026): подсказки и повторного заголовка на странице нет.
 */
const card = ref<ICardcoopCard | null>(null);
const loading = ref(true);

const session = useSessionStore();
const system = useSystemStore();

/**
 * Как назвать состояние членства человеку и каким цветом его показать.
 *
 * Ключи — значения перечисления SDK (`CardcoopAttestationState`), они с заглавной:
 * GraphQL отдаёт имена членов перечисления, а не строки контроллера. Со строчными
 * ключами чип показывал «Состояние неизвестно» при подтверждённом членстве (03.09.2026).
 */
const STATUS: Record<string, { label: string; variant: BaseChipVariant }> = {
  Active: { label: t('user.cardcoopPage.status.active'), variant: 'pos' },
  Pending: { label: t('user.cardcoopPage.status.pending'), variant: 'warn' },
  Revoked: { label: t('user.cardcoopPage.status.revoked'), variant: 'neutral' },
  Rejected: { label: t('user.cardcoopPage.status.rejected'), variant: 'neg' },
};

const status = computed(
  () => STATUS[card.value?.state ?? ''] ?? { label: t('user.cardcoopPage.status.unknown'), variant: 'neutral' as BaseChipVariant }
);

/** Номер показывается четырьмя блоками — так его читают вслух и переписывают. */
const formattedNumber = computed(() => (card.value?.cardNumber ?? '').replace(/(.{4})(?=.)/g, '$1 '));

/** Сеть, в которой живёт карта, — по адресу входа, руками нигде не вписывается. */
const networkHost = computed(() => {
  try {
    return card.value?.enterUrl ? new URL(card.value.enterUrl).host : '';
  } catch {
    return '';
  }
});

/**
 * Держатель на карте — как в кабинете card.coop: то же имя, что на удостоверении.
 * Имя берётся из анкеты в кооперативе, а не из сети: card.coop кооперативу его не отдаёт.
 */
const profile = computed(
  () =>
    session.privateAccount?.individual_data ||
    session.privateAccount?.entrepreneur_data ||
    session.privateAccount?.organization_data ||
    null
);
const { displayName, isIP } = useDisplayName(profile.value);
const holderName = computed(() => (isIP.value ? t('user.cardcoopPage.ipPrefix') : '') + (displayName.value || ''));

/** Печать в углу — первая буква имени; у безымянного держателя печати нет. */
const seal = computed(() => holderName.value.trim().charAt(0).toUpperCase());

const coopName = computed(() => system.cooperativeDisplayName || system.info.coopname);

/** Что даёт карта — тремя короткими пунктами, без маркетинга. */
const PURPOSE = [
  {
    icon: 'login',
    title: t('user.cardcoopPage.purpose.loginTitle'),
    text: t('user.cardcoopPage.purpose.loginText'),
  },
  {
    icon: 'how_to_reg',
    title: t('user.cardcoopPage.purpose.joinTitle'),
    text: t('user.cardcoopPage.purpose.joinText'),
  },
  {
    icon: 'apps',
    title: t('user.cardcoopPage.purpose.servicesTitle'),
    text: t('user.cardcoopPage.purpose.servicesText'),
  },
] as const;

/**
 * Уводит человека в сеть карт.
 *
 * Один и тот же адрес и для выпуска, и для входа: у кого карты нет — выпустит, у кого есть —
 * попадёт в свой кабинет. Второй адрес означал бы второе место, где можно ошибиться.
 */
const openCard = (): void => {
  if (card.value?.enterUrl) window.open(card.value.enterUrl, '_blank', 'noopener');
};

const { registerAction } = useHeaderActions();

watchEffect(() => {
  cardcoopHeaderState.value = {
    issued: Boolean(card.value?.issued),
    loading: loading.value,
    onOpen: openCard,
  };
});

/**
 * Читает состояние карты из журнала кооператива.
 *
 * @param silent — тихое перечитывание: экран уже нарисован, и подменять его скелетом ради
 * фонового обновления значит мигать на ровном месте.
 */
const load = async (silent = false): Promise<void> => {
  if (!silent) loading.value = true;
  try {
    card.value = await cardcoopCardApi.loadMyCard();
  } finally {
    loading.value = false;
  }
};

/**
 * Возврат на вкладку — повод перечитать: карта выпускается НЕ здесь.
 *
 * Человек уходит по кнопке в сеть карт, выпускает карту там и возвращается сюда — а стол
 * всё ещё показывает «Карта ещё не выпущена», потому что состояние он спросил один раз при
 * открытии. Приходилось уходить на соседнюю страницу и обратно, чтобы увидеть правду
 * (замечание владельца 08.09.2026). Тем же обновлением подхватывается и подтверждение
 * членства, которое кооператив мог выдать, пока вкладка лежала в стороне.
 */
const onVisible = (): void => {
  if (document.visibilityState === 'visible') void load(true);
};

onMounted(async () => {
  registerAction({ id: 'cardcoop-actions', component: CardcoopHeaderActions, order: 1 });
  await load();
  document.addEventListener('visibilitychange', onVisible);
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible);
  cardcoopHeaderState.value = null;
});
</script>

<style lang="scss" scoped>
/* Отступы страницы — как у профиля: карточки не прилипают к краям экрана. */
.cardcoop-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-6);
}

/* Слева карта, справа строки; на узком экране карта встаёт над строками. */
.card-layout {
  display: flex;
  align-items: flex-start;
  gap: var(--p-6);
  flex-wrap: wrap;
}
.card-layout__visual {
  flex: 0 0 360px;
  max-width: 100%;
  border-radius: var(--p-r-lg);
}
.card-layout__rows {
  flex: 1 1 320px;
  min-width: 0;
}

/*
 * Изображение членского билета сети «Карта кооператора» — как в её кабинете. Цвета здесь
 * свои, а не токены стола: это не поверхность интерфейса, а бланк чужого документа, и
 * в тёмной и светлой теме он одинаков, как настоящий. Единственное место на странице с
 * заливкой и тенью — по замыслу (владелец 03.09.2026).
 */
.member-card {
  position: relative;
  aspect-ratio: 1.586;
  padding: var(--p-5);
  border-radius: var(--p-r-xl);
  display: grid;
  align-content: space-between;
  color: #eef4ef;
  overflow: hidden;
  background: radial-gradient(120% 130% at 78% 8%, #1d7a4d 0%, #114c31 46%, #0c3823 100%);
  box-shadow: var(--p-shadow-card);

  /* Гильош: тонкая сетка линий, как на бланке */
  &::before {
    content: '';
    position: absolute;
    inset: -20%;
    background:
      repeating-linear-gradient(58deg, rgb(255 255 255 / 7%) 0 1px, transparent 1px 9px),
      repeating-linear-gradient(-58deg, rgb(255 255 255 / 5%) 0 1px, transparent 1px 13px);
    opacity: 0.75;
    pointer-events: none;
  }

  /* Внутренняя рамка — та, что печатают по краю бланка */
  &::after {
    content: '';
    position: absolute;
    inset: 10px;
    border: 1px solid rgb(255 255 255 / 16%);
    border-radius: var(--p-r-md);
    pointer-events: none;
  }

  &__row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3);
  }

  &__brand {
    font-family: var(--p-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    padding: 4px 10px;
    border-radius: var(--p-r-sm);
    background: rgb(255 255 255 / 12%);
  }

  &__seal {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid rgb(255 255 255 / 40%);
    display: grid;
    place-items: center;
    font-size: 11px;
    font-weight: 600;
  }

  &__number {
    position: relative;
    font-family: var(--p-mono);
    font-variant-numeric: tabular-nums;
    font-size: clamp(19px, 2.4vw, 24px);
    letter-spacing: 0.06em;
    text-shadow: 0 1px 0 rgb(0 0 0 / 25%);
  }

  &__foot {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--p-3);
  }

  &__right {
    text-align: right;
  }

  &__cap {
    font-size: 10.5px;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    opacity: 0.62;
  }

  &__val {
    font-size: 13.5px;
    font-weight: 500;
  }
}

.purpose {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.purpose__lead {
  margin: 0;
  color: var(--p-ink-2);
  max-width: 72ch;
}
.purpose__items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--p-4);
}
.purpose__item {
  display: flex;
  gap: var(--p-3);
  align-items: flex-start;
}
.purpose__icon {
  color: var(--p-primary);
  flex-shrink: 0;
  margin-top: 2px;
}
.purpose__title {
  font-weight: 600;
  color: var(--p-ink);
}
.purpose__text {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
</style>
