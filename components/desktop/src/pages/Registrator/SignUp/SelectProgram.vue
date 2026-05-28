<template lang="pug">
div
  q-step(
    :name='registratorStore.steps.SelectProgram',
    title='Выберите программу участия',
    :done='registratorStore.isStepDone("SelectProgram")'
  )
    div(v-if='isLoading').full-width.text-center.q-mt-lg.q-mb-lg
      Loader(text='Загружаем доступные программы...')

    .programs(v-else-if='programs.length > 0')
      p.programs__hint Выберите программу, в которой вы хотите участвовать
      .programs__list
        BaseRadioCard(
          v-for='program in programs',
          :key='program.key',
          :model-value='registratorStore.state.selectedProgramKey',
          :value='program.key',
          :title='program.title',
          :description='program.description',
          :meta='program.requirements',
          @update:model-value='selectProgram(program.key)'
        )

    .programs--empty(v-else)
      p Доступных программ не найдено

    .row.q-gutter-md.q-mt-lg.q-mb-lg
      BaseButton(variant='ghost', @click='registratorStore.prev()')
        i.fa.fa-arrow-left
        span.q-ml-md назад

      BaseButton(
        variant='primary',
        :disabled='!registratorStore.state.selectedProgramKey',
        @click='registratorStore.next()'
      ) Продолжить
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useRegistratorStore } from 'src/entities/Registrator';
import { useSystemStore } from 'src/entities/System/model';
import { Loader } from 'src/shared/ui/Loader';
import { FailAlert } from 'src/shared/api';
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseRadioCard } from 'src/shared/ui/base/BaseRadioCard';

const registratorStore = useRegistratorStore();
const systemStore = useSystemStore();

const isLoading = ref(false);
const isLoadingPrograms = ref(false);
const programs = ref<any[]>([]);

const loadPrograms = async () => {
  // Защита от повторных вызовов
  if (isLoadingPrograms.value) {
    return;
  }

  try {
    isLoadingPrograms.value = true;
    isLoading.value = true;

    const accountType = registratorStore.state.userData.type;
    if (!accountType) {
      console.error('Account type not selected');
      return;
    }

    const { [Queries.System.GetRegistrationConfig.name]: config } = await client.Query(
      Queries.System.GetRegistrationConfig.query,
      {
        variables: {
          coopname: systemStore.info.coopname,
          account_type: accountType,
        },
      }
    );

    programs.value = config.programs || [];

    // Если программа только одна - автоматически выбираем её и переходим дальше
    if (programs.value.length === 1) {
      registratorStore.state.selectedProgramKey = programs.value[0].key;
      registratorStore.next();
    } else if (programs.value.length === 0) {
      // Если программ нет - просто переходим дальше
      registratorStore.next();
    }
  } catch (e: any) {
    console.error('Error loading programs:', e);
    FailAlert(e);
    // В случае ошибки все равно переходим дальше
    registratorStore.next();
  } finally {
    isLoading.value = false;
    isLoadingPrograms.value = false;
  }
};

const selectProgram = (key: string) => {
  registratorStore.state.selectedProgramKey = key;
};

// Используем только watch с immediate: true вместо onMounted + watch
watch(() => registratorStore.state.step, (value: number) => {
  if (value === registratorStore.steps.SelectProgram) {
    loadPrograms();
  }
}, { immediate: true });
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
