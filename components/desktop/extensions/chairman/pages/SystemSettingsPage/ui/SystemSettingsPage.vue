<template lang="pug">
.settings-page
  //- Заголовок страницы не дублируем — он уже показан крошкой в шапке.
  //- Пояснение размещаем на канон-поверхности (.banner), а не на голом фоне.
  .banner
    q-icon.banner__icon(name='fa-solid fa-circle-info' size='18px')
    .banner__body
      | Настройте рабочие столы и страницы, которые будут открываться по
      | умолчанию для новых пользователей при входе на сайт.

  q-card(flat)
    q-card-section
      DefaultPagesForm(
        :loading='saving'
        @submit='onSubmit'
        @success='onSuccess'
        @error='onError'
      )
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { DefaultPagesForm } from 'app/extensions/chairman/features/UpdateSettings/ui';

const saving = ref(false);
const systemStore = useSystemStore();

onMounted(async () => {
  if (!systemStore.info) {
    await systemStore.loadSystemInfo();
  }
});

const onSubmit = () => {
  saving.value = true;
};

const onSuccess = () => {
  saving.value = false;
};

const onError = (error: Error) => {
  saving.value = false;
  console.error('Ошибка сохранения настроек:', error);
};
</script>

<style scoped lang="scss">
// Канон-отступы страницы (как на прочих столах).
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  padding: var(--p-6, 24px);
  @media (max-width: 768px) {
    padding: var(--p-4, 16px);
  }
}
</style>
