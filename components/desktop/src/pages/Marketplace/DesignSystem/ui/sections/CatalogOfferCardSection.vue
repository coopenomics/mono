<template>
  <div class="mp-catalog-offer-card-section">
    <div class="text-h5 q-mb-md">CatalogOfferCard · Story 10.2.4 · UX-DR10</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Карточка предложения в каталоге Витрины. Канон Стола Заказов:
      обёртка над существующим <code>widgets/Marketplace/RequestCard</code>
      с расширенным API (status, описание, slot actions, fallback изображения).
    </div>

    <!-- Состояния: все 6 status'ов -->
    <div class="text-h6 q-mt-md q-mb-sm">Все состояния (status)</div>
    <div class="row q-col-gutter-md">
      <div v-for="o in offers" :key="o.id" class="col-12 col-sm-6 col-md-3">
        <CatalogOfferCard :offer="o" @click="onClick" />
      </div>
    </div>

    <!-- Без изображения / нет описания -->
    <div class="text-h6 q-mt-xl q-mb-sm">Edge cases</div>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-sm-6 col-md-4">
        <div class="text-caption q-mb-xs">Нет preview (placeholder-иконка)</div>
        <CatalogOfferCard :offer="noPreview" />
      </div>
      <div class="col-12 col-sm-6 col-md-4">
        <div class="text-caption q-mb-xs">Длинные title и описание (clamp)</div>
        <CatalogOfferCard :offer="longText" />
      </div>
      <div class="col-12 col-sm-6 col-md-4">
        <div class="text-caption q-mb-xs">Slot actions (использование в OfferPage)</div>
        <CatalogOfferCard :offer="withActions">
          <template #actions="{ offer }">
            <q-btn flat dense label="Подробнее" />
            <q-btn unelevated dense color="primary" :label="`Купить ${offer.unitCost} ₽`" />
          </template>
        </CatalogOfferCard>
      </div>
    </div>

    <!-- Last click -->
    <q-banner v-if="lastClicked" class="bg-grey-2 q-mt-lg" rounded>
      Последний клик: <strong>{{ lastClicked.title }}</strong>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CatalogOfferCard, type CatalogOffer } from 'src/widgets/Marketplace/CatalogOfferCard'

const lastClicked = ref<CatalogOffer | null>(null)
function onClick(offer: CatalogOffer) { lastClicked.value = offer }

const offers: CatalogOffer[] = [
  {
    id: 1, title: 'Картофель «Невский» от КФХ Иваново',
    preview: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400',
    remainUnits: 240, unitCost: 35, unitLabel: 'кг', status: 'published',
    description: 'Сорт «Невский», урожай 2026 г., чистый, без проростков. Поставка через ПВЗ.',
  },
  {
    id: 2, title: 'Мёд гречишный 0.5 кг',
    preview: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400',
    remainUnits: 0, unitCost: 850, unitLabel: 'шт', status: 'sold-out',
    description: 'Натуральный гречишный мёд с пасеки кооператива «Лето».',
  },
  {
    id: 3, title: 'Молоко цельное (фермерское)',
    preview: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400',
    remainUnits: 50, unitCost: 120, unitLabel: 'л', status: 'paused',
    description: 'Поставка приостановлена: технический перерыв на ферме.',
  },
  {
    id: 4, title: 'Творог фермерский 9% — пробный лот',
    preview: 'https://images.unsplash.com/photo-1559561853-08451507cbe7?w=400',
    remainUnits: 30, unitCost: 380, unitLabel: 'кг', status: 'moderation',
    description: 'Предложение направлено председателю на проверку оферты.',
  },
  {
    id: 5, title: 'Яйца куриные С1 (10 шт.)',
    preview: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=400',
    remainUnits: 12, unitCost: 110, unitLabel: 'уп', status: 'draft',
    description: 'Заполняется автором, скоро будет опубликовано.',
  },
  {
    id: 6, title: 'Морковь столовая 5 кг',
    preview: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400',
    remainUnits: 0, unitCost: 220, unitLabel: 'упак', status: 'completed',
    description: 'Поставка закрыта, заявки выполнены.',
  },
]

const noPreview: CatalogOffer = {
  id: 'np', title: 'Картофель в сетке 5 кг', remainUnits: 100, unitCost: 200, unitLabel: 'упак', status: 'published',
}

const longText: CatalogOffer = {
  id: 'lt',
  title: 'Очень-очень длинное название предложения, которое не помещается в две строки и должно обрезаться',
  preview: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=400',
  description: 'Описание тоже очень длинное и должно обрезаться по двум строкам через -webkit-line-clamp без вылезания за рамки карточки и без смещения остальных элементов. Описание тоже очень длинное.',
  remainUnits: 999, unitCost: 12345.67, unitLabel: 'кг', status: 'published',
}

const withActions: CatalogOffer = {
  id: 'wa', title: 'Сыр адыгейский 1 кг',
  preview: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=400',
  remainUnits: 18, unitCost: 540, unitLabel: 'кг', status: 'published',
}
</script>
