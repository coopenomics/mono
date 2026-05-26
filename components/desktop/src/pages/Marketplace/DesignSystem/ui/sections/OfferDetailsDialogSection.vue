<template>
  <div class="mp-offer-details-section">
    <div class="text-h5 q-mb-md">OfferDetailsDialog · Story 3.x · UX-DR10</div>
    <div class="text-body2 text-grey-7 q-mb-lg">
      Модальное окно детального просмотра <code>Offer</code>'а. Карточки
      <code>CatalogOfferCard</code> на модерации, в каталоге и в «Мои
      предложения» по клику открывают этот диалог: полное описание,
      мета-блок и slot <code>actions</code> под ролевые кнопки (одобрить /
      отклонить — председатель; редактировать / снять / запустить — поставщик).
    </div>

    <div class="text-h6 q-mt-md q-mb-sm">Варианты</div>
    <div class="row q-col-gutter-sm">
      <div class="col-auto">
        <q-btn unelevated no-caps color="primary" label="Поставщик: на модерации" @click="open('supplier')" />
      </div>
      <div class="col-auto">
        <q-btn unelevated no-caps color="primary" label="Председатель: модерация" @click="open('admin')" />
      </div>
      <div class="col-auto">
        <q-btn unelevated no-caps color="negative" label="Отклонённое (причина)" @click="open('rejected')" />
      </div>
      <div class="col-auto">
        <q-btn flat no-caps label="Без описания / без preview" @click="open('empty')" />
      </div>
    </div>

    <OfferDetailsDialog v-model="dialogOpen" :offer="current">
      <template v-if="variant === 'supplier'" #actions>
        <q-btn flat no-caps label="Снять с публикации" color="negative" />
        <q-btn unelevated no-caps color="primary" icon="fa-solid fa-pen" label="Редактировать" />
      </template>
      <template v-else-if="variant === 'admin' || variant === 'rejected'" #actions>
        <q-btn flat no-caps label="Отклонить" color="negative" />
        <q-btn unelevated no-caps color="primary" icon="fa-solid fa-check" label="Одобрить" />
      </template>
    </OfferDetailsDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { OfferDetailsDialog, type OfferDetail } from 'src/widgets/Marketplace/OfferDetailsDialog'

type Variant = 'supplier' | 'admin' | 'rejected' | 'empty'

const dialogOpen = ref(false)
const variant = ref<Variant>('supplier')

const SAMPLES: Record<Variant, OfferDetail> = {
  supplier: {
    id: 1, title: 'Творог фермерский 9% — пробный лот',
    preview: 'https://images.unsplash.com/photo-1559561853-08451507cbe7?w=600',
    description: 'Творог из цельного фермерского молока, жирность 9%. Поставка партиями через ПВЗ кооператива. Срок хранения 5 суток с даты приёмки.',
    status: 'moderation', unitCost: 380, unitLabel: 'кг', remainUnits: 30,
    categoryName: 'Молочные продукты', cycleType: 'time_based', warrantyDays: 0,
  },
  admin: {
    id: 2, title: 'Картофель «Невский» от КФХ Иваново',
    preview: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600',
    description: 'Сорт «Невский», урожай 2026 г., чистый, без проростков.',
    status: 'moderation', unitCost: 35, unitLabel: 'кг', remainUnits: 240,
    categoryName: 'Овощи и фрукты', cycleType: 'volume_based', warrantyDays: 0,
    supplierAccount: 'kfh-ivanovo',
  },
  rejected: {
    id: 3, title: 'Мёд гречишный 0.5 кг',
    preview: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600',
    description: 'Натуральный гречишный мёд с пасеки кооператива «Лето».',
    status: 'paused', unitCost: 850, unitLabel: 'шт', remainUnits: 0,
    categoryName: 'Бакалея', cycleType: 'individual', warrantyDays: 0,
    rejectReason: 'Не приложен документ о соответствии (ветсправка). Добавьте и отправьте на модерацию повторно.',
  },
  empty: {
    id: 4, title: 'Морковь столовая 5 кг (без описания)',
    status: 'published', unitCost: 220, unitLabel: 'упак', unlimited: true,
    categoryName: 'Овощи и фрукты', cycleType: 'open_subscription',
  },
}

const current = computed<OfferDetail>(() => SAMPLES[variant.value])

function open(v: Variant): void {
  variant.value = v
  dialogOpen.value = true
}
</script>
