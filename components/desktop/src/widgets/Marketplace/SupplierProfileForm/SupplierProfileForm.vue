<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { t } from 'src/shared/i18n';
import { fileToBase64 } from 'src/shared/lib/utils';
import { BaseButton, BaseCard, BaseInput } from 'src/shared/ui/base';
import { FileUploader, type FileUploaderError } from 'src/shared/ui/domain';
import type {
  IUpdateSupplierProfileInput,
  MarketplaceSupplierProfileView,
} from 'src/entities/MarketplaceSupplierProfile';

/**
 * Форма профиля поставщика: обложка, название и рассказ о себе. Одна форма на
 * два стола — поставщик правит свой профиль, администратор — профиль
 * кооператива; чем сохранять, решает страница (`save`).
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

/** Обложка, которая останется после сохранения: новая, прежняя либо никакой. */
const currentCoverUrl = computed(() => (removeCover.value ? null : props.profile?.cover_url ?? null));
const aboutError = computed(() =>
  about.value.length > ABOUT_MAX ? t('marketplace.supplierProfileForm.aboutTooLong', { max: ABOUT_MAX }) : undefined,
);
const nameError = computed(() =>
  displayName.value.length > NAME_MAX ? t('marketplace.supplierProfileForm.nameTooLong', { max: NAME_MAX }) : undefined,
);
const canSave = computed(() => !aboutError.value && !nameError.value);

// Профиль пришёл либо обновился после сохранения — поля берутся из него.
watch(
  () => props.profile,
  (profile) => {
    displayName.value = profile?.custom_display_name ?? '';
    about.value = profile?.about ?? '';
    coverFile.value = null;
    removeCover.value = false;
  },
  { immediate: true },
);

function onCoverPicked(value: File | File[] | null): void {
  coverFile.value = Array.isArray(value) ? value[0] ?? null : value;
  if (coverFile.value) removeCover.value = false;
}

function onCoverError(error: FileUploaderError): void {
  FailAlert(error.message);
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
</script>

<template lang="pug">
BaseCard.profile-form
  .profile-form__fields
    .profile-form__cover
      .profile-form__label {{ $t('marketplace.supplierProfileForm.coverLabel') }}
      .profile-form__cover-current(v-if="currentCoverUrl && !coverFile")
        q-img.profile-form__cover-img(:src="currentCoverUrl", :ratio="16 / 9", fit="cover")
        BaseButton(variant="secondary", size="sm", @click="removeCover = true") {{ $t('marketplace.supplierProfileForm.removeCoverAction') }}
      FileUploader(
        :model-value="coverFile",
        :accept="COVER_ACCEPT",
        :max-size="COVER_MAX_BYTES",
        :title="$t('marketplace.supplierProfileForm.coverPickTitle')",
        :hint="$t('marketplace.supplierProfileForm.coverPickHint')",
        @update:model-value="onCoverPicked",
        @error="onCoverError"
      )
    BaseInput(
      v-model="displayName",
      :label="$t('marketplace.supplierProfileForm.nameLabel')",
      :hint="$t('marketplace.supplierProfileForm.nameHint')",
      :error="nameError"
    )
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
    slot(name="actions")
    BaseButton(variant="primary", :loading="saving", :disabled="!canSave", @click="submit") {{ $t('marketplace.supplierProfileForm.saveAction') }}
</template>

<style scoped lang="scss">
.profile-form {
  &__fields {
    display: flex;
    flex-direction: column;
    gap: var(--p-4);
  }

  &__cover {
    display: flex;
    flex-direction: column;
    gap: var(--p-2);
  }

  &__label {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-2);
  }

  &__cover-current {
    display: flex;
    align-items: flex-end;
    gap: var(--p-3);
    flex-wrap: wrap;
  }

  &__cover-img {
    width: 320px;
    max-width: 100%;
    border: 1px solid var(--p-line);
    border-radius: var(--p-r-md);
  }

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
