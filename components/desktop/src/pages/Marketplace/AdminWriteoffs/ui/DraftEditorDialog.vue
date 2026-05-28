<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import {
  cancelWriteoffDraft,
  createWriteoffDraft,
  updateWriteoffDraft,
  type ICreateWriteoffDraftInput,
  type IUpdateWriteoffDraftInput,
  type MarketplaceWriteoffProposalView,
} from '../api';

/**
 * Эпик 8: диалог редактирования черновика проекта списания. Если
 * `existingDraft` передан — диалог редактирует существующий черновик
 * (`marketplaceUpdateWriteoffDraft`); если null — создаёт новый
 * (`marketplaceCreateWriteoffDraft`). Также позволяет полностью отменить
 * существующий черновик кнопкой «Удалить черновик».
 */

const props = defineProps<{
  modelValue: boolean;
  existingDraft: MarketplaceWriteoffProposalView | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', proposal: MarketplaceWriteoffProposalView): void;
  (e: 'cancelled'): void;
}>();

interface EditableItem {
  braname: string;
  asset_title: string;
  quantity: string;
  amount: string;
  reason: string;
  inventory_id: string | null;
}

const items = ref<EditableItem[]>([]);
const saving = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      items.value = (props.existingDraft?.items ?? []).map((it) => ({
        braname: it.braname,
        asset_title: it.asset_title,
        quantity: it.quantity,
        amount: it.amount,
        reason: it.reason,
        inventory_id: it.inventory_id ?? null,
      }));
      if (items.value.length === 0) addItem();
    }
  },
);

function addItem(): void {
  items.value.push({
    braname: '',
    asset_title: '',
    quantity: '1',
    amount: '0.0000',
    reason: '',
    inventory_id: null,
  });
}

function removeItem(idx: number): void {
  items.value.splice(idx, 1);
}

const totalAmount = computed(() =>
  items.value.reduce((acc, it) => acc + (Number.parseFloat(it.amount) || 0), 0).toFixed(4),
);

async function save(): Promise<void> {
  if (items.value.length === 0) {
    FailAlert(null, 'Добавьте хотя бы одну позицию');
    return;
  }
  for (const it of items.value) {
    if (!it.braname || !it.asset_title) {
      FailAlert(null, 'У каждой позиции должны быть указаны КУ и наименование');
      return;
    }
    const amount = Number(it.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      FailAlert(null, 'Сумма позиции должна быть положительным числом');
      return;
    }
  }
  saving.value = true;
  try {
    if (props.existingDraft) {
      const payload: IUpdateWriteoffDraftInput = {
        id: props.existingDraft.id,
        items: items.value.map((it) => ({
          braname: it.braname,
          asset_title: it.asset_title,
          quantity: it.quantity,
          amount: it.amount,
          reason: it.reason,
          inventory_id: it.inventory_id ?? undefined,
        })),
      };
      const updated = await updateWriteoffDraft(payload);
      SuccessAlert(`Сохранено ${updated.items.length} позиций`);
      emit('saved', updated);
    } else {
      const payload: ICreateWriteoffDraftInput = {
        items: items.value.map((it) => ({
          braname: it.braname,
          asset_title: it.asset_title,
          quantity: it.quantity,
          amount: it.amount,
          reason: it.reason,
          inventory_id: it.inventory_id ?? undefined,
        })),
      };
      const created = await createWriteoffDraft(payload);
      SuccessAlert(`Черновик создан: ${created.items.length} позиций`);
      emit('saved', created);
    }
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось сохранить черновик');
  } finally {
    saving.value = false;
  }
}

async function cancelDraftAndClose(): Promise<void> {
  if (!props.existingDraft) return;
  saving.value = true;
  try {
    await cancelWriteoffDraft(props.existingDraft.id);
    SuccessAlert('Черновик удалён');
    emit('cancelled');
    emit('update:modelValue', false);
  } catch (e) {
    FailAlert(e, 'Не удалось удалить черновик');
  } finally {
    saving.value = false;
  }
}
</script>

<template lang="pug">
q-dialog(
  :model-value="modelValue"
  @update:model-value="(v) => emit('update:modelValue', v)"
  full-width persistent
)
  q-card
    q-card-section.row.items-center
      .text-h6 {{ existingDraft ? 'Редактирование черновика' : 'Новый черновик списания' }}
      q-space
      q-btn(flat round icon="close" @click="emit('update:modelValue', false)")

    q-card-section
      q-list(bordered separator)
        q-item(v-for="(it, idx) in items" :key="idx")
          q-item-section
            .row.q-col-gutter-sm
              q-input.col-2(v-model="it.braname" label="КУ" dense outlined)
              q-input.col-3(v-model="it.asset_title" label="Наименование" dense outlined)
              q-input.col-1(v-model="it.quantity" label="Кол-во" dense outlined)
              q-input.col-2(v-model="it.amount" label="Сумма" dense outlined)
              q-input.col-4(v-model="it.reason" label="Причина" dense outlined)
          q-item-section(side)
            q-btn(flat round dense color="negative" icon="delete" @click="removeItem(idx)")
      q-btn.q-mt-sm(flat no-caps icon="add" label="Добавить позицию" @click="addItem")

    q-card-section.row.items-center
      .text-body1 ИТОГО: {{ formatAsset2Digits(totalAmount) }} ₽
      q-space
      q-btn.q-mr-sm(
        v-if="existingDraft"
        flat no-caps color="negative"
        label="Удалить черновик"
        :loading="saving"
        @click="cancelDraftAndClose"
      )
      q-btn(
        unelevated no-caps color="primary"
        label="Сохранить"
        :loading="saving"
        @click="save"
      )
</template>
