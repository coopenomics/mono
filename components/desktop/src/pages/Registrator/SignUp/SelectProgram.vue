<template lang="pug">
div(v-show='registratorStore.isStep("SelectProgram")')
    .programs(v-if='programs.length > 0')
      p.programs__hint {{ $t('registrator.selectProgram.hint') }}
      .programs__list
        BaseRadioCard(
          v-for='program in programs',
          :key='program.key',
          :model-value='registratorStore.state.selectedProgramKey',
          :value='program.key',
          :title='program.title',
          :description='program.description',
          :meta='program.requirements ?? undefined',
          @update:model-value='selectProgram(program.key)'
        )

    .programs--empty(v-else)
      p {{ $t('registrator.selectProgram.empty') }}

    .row.q-gutter-md.q-mt-lg.q-mb-lg
      BaseButton(variant='ghost', @click='registratorStore.prev()')
        q-icon(name='arrow_back')
        span.q-ml-md {{ $t('registrator.selectProgram.back') }}

      BaseButton(
        variant='primary',
        :disabled='!registratorStore.state.selectedProgramKey',
        @click='registratorStore.next()'
      ) {{ $t('registrator.selectProgram.submit') }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRegistratorStore } from 'src/entities/Registrator';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseRadioCard } from 'src/shared/ui/base/BaseRadioCard';

const registratorStore = useRegistratorStore();

// Список программ — из стора (загружается на шаге SetUserData по бэкенду).
// Этот шаг рендерится только когда есть из чего выбирать (2+), см. v-if в
// SignUp.vue, поэтому собственной загрузки/авто-скипа здесь не требуется.
const programs = computed(() => registratorStore.availablePrograms);

const selectProgram = (key: string) => {
  registratorStore.state.selectedProgramKey = key;
  registratorStore.state.programAutoSelected = false;
};
</script>

<style scoped>
.programs {
  margin: var(--p-4, 16px) 0;
}
.programs__hint {
  font-size: var(--p-fs-body, 14px);
  color: var(--p-ink-2);
  margin: 0 0 var(--p-3, 12px);
}
.programs__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
.programs--empty {
  text-align: center;
  color: var(--p-ink-2);
  margin: var(--p-6, 24px) 0;
}
</style>
