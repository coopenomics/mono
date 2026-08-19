<template lang="pug">
BaseDialog(
  v-model='open',
  :title='session.hasCustomPin ? "Смена PIN-кода" : "Установка PIN-кода"',
  size='sm'
)
  //- Два шага одной клавиатурой, а не два поля рядом: PIN набирают вслепую, и
  //- второй набор нужен как проверка, а не как копия видимого сверху.
  .set-pin__form
    p.set-pin__lead(v-if='lead') {{ lead }}
    p.set-pin__step
      template(v-if='step === "first"') Придумайте PIN-код: от 4 до 6 цифр.
      template(v-else) Повторите PIN-код, чтобы не ошибиться в наборе.
    PinPad(
      ref='padRef',
      v-model='entry',
      :error='entryError',
      :disabled='saving',
      autofocus,
      @complete='onNext'
    )
  template(#footer)
    BaseButton(
      variant='secondary',
      :disabled='saving',
      @click='onBack'
    ) {{ step === 'first' ? 'Отмена' : 'Назад' }}
    BaseButton(
      variant='primary',
      :loading='saving',
      :disabled='!canGoNext',
      @click='onNext'
    ) {{ step === 'first' ? 'Далее' : 'Сохранить' }}
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from 'vue';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { PinPad } from 'src/shared/ui/domain';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';

const props = defineProps<{
  modelValue: boolean;
  /** Пояснение над набором — зачем PIN понадобился именно сейчас. */
  lead?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [];
}>();

const session = useSessionStore();

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const padRef = ref<{ focusCell: (index?: number) => void } | null>(null);

/** Набранное на текущем шаге; первый шаг откладывается в `pin`. */
const entry = ref('');
const pin = ref('');
const step = ref<'first' | 'repeat'>('first');
const mismatch = ref(false);
const saving = ref(false);

/** Каждый новый набор начинается с первой ячейки: после шага «придумайте» и
 *  после несовпадения фокус иначе остаётся на последней заполненной ячейке —
 *  пайщик набирает заново, а курсор стоит не там. */
function restartEntry(): void {
  entry.value = '';
  void nextTick(() => padRef.value?.focusCell(0));
}

const isValidPin = computed(() => /^\d{4,6}$/.test(entry.value));
const canGoNext = computed(() => isValidPin.value);

const entryError = computed(() => {
  if (mismatch.value) return 'PIN-коды не совпадают — наберите заново';
  return entry.value && !isValidPin.value ? 'PIN — от 4 до 6 цифр' : '';
});

// Каждое открытие начинается с чистого листа: набранное в прошлый раз не должно
// всплывать в ячейках, а незакрытый шаг «повторите» — ждать неизвестно чего.
watch(open, (value) => {
  if (!value) return;
  entry.value = '';
  pin.value = '';
  step.value = 'first';
  mismatch.value = false;
});

/** Отмена на первом шаге закрывает диалог, на втором — возвращает к набору. */
function onBack(): void {
  if (step.value === 'first') {
    open.value = false;
    return;
  }
  step.value = 'first';
  mismatch.value = false;
  restartEntry();
}

async function onNext(): Promise<void> {
  if (!canGoNext.value || saving.value) return;

  if (step.value === 'first') {
    pin.value = entry.value;
    mismatch.value = false;
    step.value = 'repeat';
    restartEntry();
    return;
  }

  if (entry.value !== pin.value) {
    // Не совпало — начинаем с чистого листа: подсказывать, какой из двух наборов
    // ошибочен, нечем, а угадывать пайщику вслепую утомительно.
    mismatch.value = true;
    pin.value = '';
    step.value = 'first';
    restartEntry();
    return;
  }

  saving.value = true;
  try {
    await session.setCustomPin(pin.value);
    SuccessAlert('PIN-код сохранён');
    open.value = false;
    emit('saved');
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.set-pin__form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.set-pin__lead,
.set-pin__step {
  margin: 0;
  text-align: center;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
.set-pin__lead {
  color: var(--p-ink);
}
</style>
