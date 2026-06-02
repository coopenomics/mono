<template lang="pug">
q-list.q-mt-sm(dense)
  q-item(v-for='(step, idx) in steps', :key='step.key')
    q-item-section(avatar)
      q-icon(
        :name='stateIcon(step.state)',
        :color='stateColor(step.state)',
        size='22px'
      )
    q-item-section
      q-item-label {{ step.label }}
      q-item-label(caption) {{ step.hint }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';

const props = defineProps<{ status: string }>();

type StepState = 'done' | 'current' | 'pending' | 'rejected';

const ORDER: Array<{ key: string; label: string; hint: string }> = [
  { key: 'created', label: 'Записка создана', hint: 'Председатель подал служебную записку (1010)' },
  { key: 'approved', label: 'Одобрено председателем', hint: 'Председатель утвердил записку' },
  { key: 'authorized', label: 'Авторизовано советом', hint: 'Совет принял протокол решения (1011)' },
  { key: 'paid', label: 'Выплачено', hint: 'Кассир подтвердил списание средств' },
];

const steps = computed(() => {
  if (props.status === 'declined') {
    return ORDER.map((s) => ({ ...s, state: 'rejected' as StepState }));
  }

  const currentIdx = ORDER.findIndex((s) => s.key === props.status);
  return ORDER.map((s, i) => {
    let state: StepState = 'pending';
    if (currentIdx < 0) state = 'pending';
    else if (i < currentIdx) state = 'done';
    else if (i === currentIdx) state = 'current';
    return { ...s, state };
  });
});

function stateIcon(state: StepState): string {
  if (state === 'done') return 'check_circle';
  if (state === 'current') return 'radio_button_checked';
  if (state === 'rejected') return 'cancel';
  return 'radio_button_unchecked';
}

function stateColor(state: StepState): string {
  if (state === 'done') return 'positive';
  if (state === 'current') return 'primary';
  if (state === 'rejected') return 'negative';
  return 'grey-5';
}
</script>
