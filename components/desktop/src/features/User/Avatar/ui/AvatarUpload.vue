<template lang="pug">
.avatar-upload
  Avatar(:name="name" :src="src || undefined" size="xl")
  .avatar-upload__actions
    BaseButton(variant="secondary" size="sm" :loading="busy" @click="pick") {{ src ? 'Заменить фотографию' : 'Загрузить фотографию' }}
    BaseButton(v-if="src" variant="ghost" size="sm" :loading="busy" @click="remove") Убрать
    .t-muted.t-meta JPEG, PNG или WEBP до 5 МБ.
  input.avatar-upload__input(ref="fileInput" type="file" :accept="ACCEPT" @change="onPicked")
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { fileToBase64 } from 'src/shared/lib/utils';
import { Avatar, BaseButton } from 'src/shared/ui/base';
import { removeAvatar, uploadAvatar } from '../api';

/**
 * Фотография пайщика: одна на аккаунт, хранится ядром. Узел ставится и в
 * удостоверении пайщика, и на столах расширений — снимок везде один, поэтому
 * загрузка на столе преподавателя меняет и удостоверение.
 */
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

defineProps<{ name: string; src?: string | null }>();
const emit = defineEmits<{ changed: [url: string | null] }>();

const fileInput = ref<HTMLInputElement | null>(null);
const busy = ref(false);

function pick(): void {
  fileInput.value?.click();
}

async function onPicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > MAX_BYTES) {
    FailAlert('Фотография больше 5 МБ — выберите файл поменьше');
    return;
  }
  busy.value = true;
  try {
    const url = await uploadAvatar({ content_base64: await fileToBase64(file), mime_type: file.type });
    SuccessAlert('Фотография обновлена');
    emit('changed', url);
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

async function remove(): Promise<void> {
  busy.value = true;
  try {
    await removeAvatar();
    SuccessAlert('Фотография убрана');
    emit('changed', null);
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.avatar-upload {
  display: flex;
  align-items: center;
  gap: var(--p-4);
}
.avatar-upload__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-2);
}
.avatar-upload__input {
  display: none;
}
</style>
