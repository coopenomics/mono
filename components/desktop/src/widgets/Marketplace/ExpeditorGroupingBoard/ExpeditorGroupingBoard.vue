<template>
  <div class="mp-egb">
    <div class="text-caption text-grey-7 q-mb-sm">
      Перетаскивайте заявки между колонками или используйте кнопку «Сгруппировать».
    </div>

    <div class="row q-col-gutter-md no-wrap mp-egb__board">
      <div
        v-for="col in columns"
        :key="col.id"
        class="mp-egb__column"
        @dragover.prevent
        @drop="onDrop(col.id, $event)"
      >
        <div class="mp-egb__col-header">
          <div class="text-subtitle1">{{ col.title }}</div>
          <q-chip dense color="grey-3" text-color="grey-8">
            {{ col.items.length }}
          </q-chip>
        </div>

        <div class="mp-egb__col-meta">
          <span v-if="col.meta">{{ col.meta }}</span>
        </div>

        <div class="mp-egb__items mp-gap-sm">
          <q-card
            v-for="item in col.items"
            :key="item.id"
            flat
            bordered
            class="mp-egb__item"
            draggable="true"
            @dragstart="onDragStart($event, item.id, col.id)"
          >
            <div class="text-body2"><strong>MP-{{ item.shortId }}</strong></div>
            <div class="text-caption text-grey-7">{{ item.title }}</div>
            <div class="text-caption">{{ item.units }} {{ item.unitLabel ?? 'ед.' }} · {{ item.pvz }}</div>
          </q-card>

          <div v-if="!col.items.length" class="mp-egb__empty">
            <q-icon name="fa-solid fa-inbox" size="32px" color="grey-5" />
            <div class="text-caption text-grey-7 q-mt-xs">Перетащите сюда</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

export interface GroupingItem {
  id: string | number
  shortId: string
  title: string
  units: number
  unitLabel?: string
  pvz: string
}

export interface GroupingColumn {
  id: string
  title: string
  meta?: string
  items: GroupingItem[]
}

const props = defineProps({
  columns: { type: Array as PropType<GroupingColumn[]>, required: true },
})

const emit = defineEmits<{
  (e: 'move', payload: { itemId: string | number; fromColumnId: string; toColumnId: string }): void
}>()

function onDragStart(ev: DragEvent, itemId: string | number, fromColumnId: string) {
  ev.dataTransfer?.setData('application/x-mp-item', JSON.stringify({ itemId, fromColumnId }))
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
}

function onDrop(toColumnId: string, ev: DragEvent) {
  const raw = ev.dataTransfer?.getData('application/x-mp-item')
  if (!raw) return
  try {
    const { itemId, fromColumnId } = JSON.parse(raw)
    if (fromColumnId === toColumnId) return
    emit('move', { itemId, fromColumnId, toColumnId })
  } catch { /* noop */ }
}
</script>

<style scoped lang="scss">
.mp-egb {
  &__board {
    overflow-x: auto;
    padding-bottom: var(--mp-space-sm);
  }

  &__column {
    min-width: 260px;
    flex: 1;
    background: rgba(0, 0, 0, .03);
    border-radius: 8px;
    padding: var(--mp-space-md);
    display: flex;
    flex-direction: column;
  }

  &__col-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--mp-space-xs);
  }

  &__col-meta {
    font-size: 12px;
    color: rgba(0, 0, 0, .55);
    margin-bottom: var(--mp-space-sm);
    min-height: 1em;
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: var(--mp-space-sm);
    flex: 1;
  }

  &__item {
    padding: var(--mp-space-sm);
    cursor: grab;
    &:active { cursor: grabbing; }
  }

  &__empty {
    border: 2px dashed rgba(0, 0, 0, .12);
    border-radius: 6px;
    padding: var(--mp-space-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
}
</style>
