<template lang="pug">
.settings-page

  .settings-content(v-if='extension')
    .settings-container
      ExtensionSettings(
        :schema='extension.schema',
        :config='extension.config',
        :form-ref='myFormRef'
        @update:config='updateConfig'
      )
  .loading(v-else)
    .q-pa-xl.text-center
      q-spinner(color='primary' size='3rem')
      .q-mt-md Загрузка настроек...
</template>

<script lang="ts" setup>
import { computed, onMounted, onActivated, ref, markRaw, onBeforeUnmount } from 'vue';
import { useExtensionStore } from 'src/entities/Extension/model';
import { ExtensionSettings } from 'src/widgets/ExtensionSettings';
import { useUpdateExtension } from 'src/features/Extension/UpdateExtension/model';
import { useHeaderActions } from 'src/shared/hooks';
import { QBtn } from 'quasar';
import {
  extractGraphQLErrorMessages,
  FailAlert,
  SuccessAlert,
} from 'src/shared/api';

const extStore = useExtensionStore();
const myFormRef = ref();
const isSaving = ref(false);

// Регистрируем действия в header
const { registerAction: registerHeaderAction, clearActions } = useHeaderActions();

// Кнопка сохранения для header
const saveButton = computed(() => ({
  id: 'settings-save-button',
  component: markRaw(QBtn),
  props: {
    color: 'primary',
    label: 'Сохранить',
    loading: isSaving.value,
    onClick: saveSettings,
  },
  order: 1,
}));


const loadExtensionData = async () => {
  await extStore.loadExtensions({ name: 'powerup' });
};

onMounted(async () => {
  await loadExtensionData();
  registerHeaderAction(saveButton.value);
});

onActivated(async () => {
  await loadExtensionData();
});

onBeforeUnmount(() => {
  clearActions();
});

const extension = computed(() =>
  extStore.extensions.find((el) => el.name === 'powerup'),
);


const validateForm = async () => {
  return await myFormRef.value?.validate();
};

const updateConfig = (newConfig: any) => {
  if (extension.value) {
    // Обновляем локальную копию config
    extension.value.config = { ...newConfig };
  }
};

const saveSettings = async () => {
  if (!extension.value) return;

  const isValid = await validateForm();
  if (isValid === false) return;

  const { updateExtension } = useUpdateExtension();
  isSaving.value = true;

  try {
    await updateExtension(
      extension.value.name,
      extension.value.enabled ?? false,
      extension.value.config,
    );
    SuccessAlert('Настройки сохранены');
    // Перезагружаем данные расширения после сохранения
    await extStore.loadExtensions({ name: 'powerup' });
  } catch (e: unknown) {
    FailAlert(
      `Ошибка сохранения настроек: ${extractGraphQLErrorMessages(e)}`,
    );
  } finally {
    isSaving.value = false;
  }
};
</script>

<style lang="scss" scoped>
.settings-page {
  padding: var(--p-6, 24px);
  max-width: 1200px;
  margin: 0 auto;
}

.settings-content {
  .settings-container {
    max-width: 1000px;
    margin: 0 auto;
  }
}

@media (max-width: 768px) {
  .settings-page {
    padding: var(--p-4, 16px);
  }
}
</style>
