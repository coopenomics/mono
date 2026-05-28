<template lang="pug">
form.request-key(@submit.prevent='submit')
  BaseInput(
    v-model='privateKey',
    label='Ключ установки',
    type='password',
    mono,
    autocomplete='off'
  )
  BaseButton(
    type='submit',
    variant='primary',
    block,
    :loading='loading',
    :disabled='!privateKey'
  ) Продолжить
</template>

<script lang="ts" setup>
import { useInstallCooperativeStore } from 'src/entities/Installer/model';
import { FailAlert } from 'src/shared/api';
import { ref } from 'vue';
import { useInstallCooperative } from '../../model';
import { useSystemStore } from 'src/entities/System/model';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const privateKey = ref('');
const loading = ref(false);

const installStore = useInstallCooperativeStore();
const systemStore = useSystemStore();
const { startInstall } = useInstallCooperative();

const submit = async () => {
  loading.value = true;
  try {
    await startInstall(privateKey.value);
    installStore.wif = privateKey.value;

    // Обновляем информацию о системе после установки ключа
    await systemStore.loadSystemInfo();

    // Всегда переходим к шагу init — там логика определит,
    // показывать readonly или форму редактирования.
    installStore.current_step = 'init';

    loading.value = false;
  } catch (e: any) {
    loading.value = false;
    FailAlert(e.message || 'Ошибка установки ключа');
  }
};
</script>

<style scoped lang="scss">
.request-key {
  display: flex;
  flex-direction: column;
  /* gap не задаём: reserve-hint-space у BaseInput уже отделяет кнопку (канон BaseForm). */
  width: 100%;
}
</style>
