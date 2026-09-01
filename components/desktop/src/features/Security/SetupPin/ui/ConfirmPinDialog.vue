<template lang="pug">
BaseDialog(v-model='open', :title='title', size='sm')
  .confirm-pin
    p.confirm-pin__lead(v-if='lead') {{ lead }}
    PinPad(
      v-model='pin',
      :error='error',
      :disabled='checking',
      autofocus,
      @complete='onSubmit'
    )
  template(#footer)
    BaseButton(variant='secondary', :disabled='checking', @click='open = false') Отмена
    BaseButton(
      variant='primary',
      :loading='checking',
      :disabled='!canSubmit',
      @click='onSubmit'
    ) Подтвердить
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { PinPad } from 'src/shared/ui/domain';
import { useSessionStore } from 'src/entities/Session';

/**
 * Подтверждение действия текущим PIN-кодом.
 *
 * Нужен там, где меняют сам PIN: снять или сменить его, не зная старого, — то же
 * самое, что обойти защиту. Кнопка в настройках срабатывала сразу, и любой, кто
 * сел за незапертое устройство, снимал PIN одним нажатием.
 */
const props = defineProps<{
  modelValue: boolean;
  title: string;
  /** Пояснение над набором — что именно подтверждают. */
  lead?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirmed: [];
}>();

const session = useSessionStore();

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const pin = ref('');
const error = ref('');
const checking = ref(false);

const canSubmit = computed(() => /^\d{4,6}$/.test(pin.value));

watch(open, (value) => {
  if (!value) return;
  pin.value = '';
  error.value = '';
});

async function onSubmit(): Promise<void> {
  if (!canSubmit.value || checking.value) return;
  checking.value = true;
  try {
    const ok = await session.verifyPin(pin.value);
    if (!ok) {
      error.value = 'Неверный PIN-код';
      pin.value = '';
      return;
    }
    open.value = false;
    emit('confirmed');
  } finally {
    checking.value = false;
  }
}
</script>

<style scoped>
.confirm-pin {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.confirm-pin__lead {
  margin: 0;
  text-align: center;
  color: var(--p-ink);
  font-size: var(--p-fs-body-sm);
}
</style>
