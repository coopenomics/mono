<template lang="pug">
button.avatar-upload(
  type="button"
  :aria-label="src ? $t('user.avatarUpload.replacePhoto') : $t('user.avatarUpload.uploadPhoto')"
  :disabled="busy"
  @click="onClick"
)
  Avatar(:name="name" :src="src || undefined" :size="size")
  span.avatar-upload__veil
    q-spinner(v-if="busy" size="20px")
    q-icon(v-else name="photo_camera" size="20px")
  q-tooltip(v-if="!busy") {{ src ? $t('user.avatarUpload.replacePhoto') : $t('user.avatarUpload.uploadPhoto') }}
  q-menu(v-if="src && !busy" auto-close anchor="bottom middle" self="top middle")
    q-list(dense style="min-width: 190px")
      q-item(clickable @click="pick")
        q-item-section {{ $t('user.avatarUpload.replacePhoto') }}
      q-item(clickable @click="remove")
        q-item-section {{ $t('user.avatarUpload.remove') }}
  input.avatar-upload__input(ref="fileInput" type="file" :accept="ACCEPT" @click.stop @change="onPicked")
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { fileToBase64 } from 'src/shared/lib/utils';
import { Avatar, type AvatarSize } from 'src/shared/ui/base';
import { removeAvatar, uploadAvatar } from '../api';
import { t } from 'src/shared/i18n';

/**
 * Фотография пайщика: одна на аккаунт, хранится ядром. Узел ставится и в
 * удостоверении пайщика, и на столах расширений — снимок везде один, поэтому
 * загрузка на столе преподавателя меняет и удостоверение.
 *
 * Весь узел — сам кружок: значок фотоаппарата всплывает поверх него при
 * наведении, а рядом остаётся место для имени. Кнопка с подписью и перечень
 * форматов занимали половину карточки ради того, что делают один раз.
 */
const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

const props = withDefaults(defineProps<{ name: string; src?: string | null; size?: AvatarSize }>(), {
  size: 'xl',
});
const emit = defineEmits<{ changed: [url: string | null] }>();

const session = useSessionStore();
const fileInput = ref<HTMLInputElement | null>(null);
const busy = ref(false);

/** Фотографии нет — клик сразу открывает выбор файла; есть — меню замены и снятия. */
function onClick(): void {
  if (!props.src) pick();
}

function pick(): void {
  fileInput.value?.click();
}

async function onPicked(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > MAX_BYTES) {
    FailAlert(t('user.avatarUpload.fileTooLarge'));
    return;
  }
  busy.value = true;
  try {
    const url = await uploadAvatar({ content_base64: await fileToBase64(file), mime_type: file.type });
    // Снимок кладётся в аккаунт сессии: столы читают его оттуда и показывают
    // новую фотографию сразу, без перезагрузки кабинета.
    session.setAvatarUrl(url);
    SuccessAlert(t('user.avatarUpload.updatedSuccess'));
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
    session.setAvatarUrl(null);
    SuccessAlert(t('user.avatarUpload.removedSuccess'));
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
  position: relative;
  display: inline-grid;
  padding: 0;
  border: none;
  background: none;
  border-radius: 50%;
  cursor: pointer;
  line-height: 0;
}
.avatar-upload:disabled {
  cursor: default;
}
.avatar-upload__veil {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(15, 23, 24, 0.5);
  color: #fff;
  opacity: 0;
  transition: opacity 0.16s ease;
}
.avatar-upload:hover .avatar-upload__veil,
.avatar-upload:focus-visible .avatar-upload__veil,
.avatar-upload:disabled .avatar-upload__veil {
  opacity: 1;
}
.avatar-upload:focus-visible {
  outline: 2px solid var(--p-primary);
  outline-offset: 2px;
}
.avatar-upload__input {
  display: none;
}
</style>
