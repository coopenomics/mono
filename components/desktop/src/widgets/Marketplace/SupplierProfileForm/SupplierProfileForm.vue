<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';
import { fileToBase64 } from 'src/shared/lib/utils';
import { BaseButton, BaseCard, BaseInput } from 'src/shared/ui/base';
import type {
  IUpdateSupplierProfileInput,
  MarketplaceSupplierProfileView,
} from 'src/entities/MarketplaceSupplierProfile';
import { SupplierProfileHead } from '../SupplierProfileHead';

/**
 * Правка профиля поставщика. Обложка и название правятся прямо в шапке —
 * такой, какой её видит заказчик; под ней карточка с рассказом о себе и
 * кнопкой сохранения. Одна форма на два стола — поставщик правит свой
 * профиль, администратор — профиль кооператива; чем сохранять, решает
 * страница (`save`).
 */
const ABOUT_MAX = 4000;
const NAME_MAX = 200;
const COVER_MAX_BYTES = 10 * 1024 * 1024;
const COVER_ACCEPT = 'image/jpeg,image/png,image/webp';

const props = defineProps<{
  profile: MarketplaceSupplierProfileView | null;
  save: (data: IUpdateSupplierProfileInput) => Promise<MarketplaceSupplierProfileView>;
}>();

const emit = defineEmits<{
  (e: 'saved', profile: MarketplaceSupplierProfileView): void;
}>();

const displayName = ref('');
const about = ref('');
const coverFile = ref<File | null>(null);
const removeCover = ref(false);
const saving = ref(false);
/** Адрес выбранного файла для показа в шапке; живёт до следующего выбора. */
const coverPreviewUrl = ref<string | null>(null);

/** Обложка в шапке: выбранный файл, снятая либо сохранённая. */
const coverOverride = computed(() => coverPreviewUrl.value ?? (removeCover.value ? null : undefined));
const aboutError = computed(() =>
  about.value.length > ABOUT_MAX ? t('marketplace.supplierProfileForm.aboutTooLong', { max: ABOUT_MAX }) : undefined,
);
const canSave = computed(() => !aboutError.value);

function releasePreview(): void {
  if (coverPreviewUrl.value) URL.revokeObjectURL(coverPreviewUrl.value);
  coverPreviewUrl.value = null;
}

// Профиль пришёл либо обновился после сохранения — поля берутся из него.
watch(
  () => props.profile,
  (profile) => {
    displayName.value = profile?.custom_display_name ?? '';
    about.value = profile?.about ?? '';
    coverFile.value = null;
    removeCover.value = false;
    releasePreview();
  },
  { immediate: true },
);

function onCoverPicked(file: File): void {
  if (!COVER_ACCEPT.split(',').includes(file.type)) {
    FailAlert(t('marketplace.supplierProfileForm.coverWrongType'));
    return;
  }
  if (file.size > COVER_MAX_BYTES) {
    FailAlert(t('marketplace.supplierProfileForm.coverTooLarge'));
    return;
  }
  releasePreview();
  coverFile.value = file;
  removeCover.value = false;
  coverPreviewUrl.value = URL.createObjectURL(file);
}

function onCoverRemove(): void {
  releasePreview();
  coverFile.value = null;
  removeCover.value = true;
}

async function submit(): Promise<void> {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  try {
    const data: IUpdateSupplierProfileInput = {
      display_name: displayName.value,
      about: about.value,
      remove_cover: removeCover.value,
    };
    if (coverFile.value) {
      data.cover = { base64: await fileToBase64(coverFile.value), mime_type: coverFile.value.type };
    }
    const saved = await props.save(data);
    SuccessAlert(t('marketplace.supplierProfileForm.savedNotice'));
    emit('saved', saved);
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}

onBeforeUnmount(releasePreview);
</script>

<template lang="pug">
.profile-form
  SupplierProfileHead(
    v-if="profile",
    :profile="profile",
    editable,
    :cover-accept="COVER_ACCEPT",
    :name-max="NAME_MAX",
    :name-override="displayName",
    :cover-override="coverOverride",
    @update:name="displayName = $event",
    @cover-pick="onCoverPicked",
    @cover-remove="onCoverRemove"
  )
    template(v-if="$slots.actions", #actions)
      slot(name="actions")

  BaseCard
    BaseInput(
      v-model="about",
      type="textarea",
      :rows="6",
      autogrow,
      :label="$t('marketplace.supplierProfileForm.aboutLabel')",
      :hint="$t('marketplace.supplierProfileForm.aboutHint', { count: about.length, max: ABOUT_MAX })",
      :error="aboutError"
    )
    .profile-form__actions
      BaseButton(variant="primary", :loading="saving", :disabled="!canSave", @click="submit") {{ $t('marketplace.supplierProfileForm.saveAction') }}
</template>

<style scoped lang="scss">
.profile-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--p-2);
    margin-top: var(--p-4);
    padding-top: var(--p-4);
    border-top: 1px solid var(--p-line);
  }
}
</style>
