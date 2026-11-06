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
 * Правка профиля поставщика. Профиль показан таким, каким его видит
 * заказчик: обложка и название правятся прямо в шапке, рассказ о себе —
 * текстом с кнопкой «Изменить», по нажатию он становится полем. Полоса
 * «Отмена / Сохранить» появляется внизу только при несохранённых правках.
 * Одна форма на два стола — поставщик правит свой профиль, администратор —
 * профиль кооператива; чем сохранять, решает страница (`save`).
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
const editingAbout = ref(false);
/** Адрес выбранного файла для показа в шапке; живёт до следующего выбора. */
const coverPreviewUrl = ref<string | null>(null);

/** Обложка в шапке: выбранный файл, снятая либо сохранённая. */
const coverOverride = computed(() => coverPreviewUrl.value ?? (removeCover.value ? null : undefined));
const aboutError = computed(() =>
  about.value.length > ABOUT_MAX ? t('marketplace.supplierProfileForm.aboutTooLong', { max: ABOUT_MAX }) : undefined,
);
const canSave = computed(() => !aboutError.value);
/** Есть несохранённые правки — показывается полоса сохранения. */
const dirty = computed(
  () =>
    displayName.value !== (props.profile?.custom_display_name ?? '') ||
    about.value !== (props.profile?.about ?? '') ||
    coverFile.value !== null ||
    removeCover.value,
);

function releasePreview(): void {
  if (coverPreviewUrl.value) URL.revokeObjectURL(coverPreviewUrl.value);
  coverPreviewUrl.value = null;
}

/** Поля — из сохранённого профиля; так же отменяются правки. */
function reset(): void {
  displayName.value = props.profile?.custom_display_name ?? '';
  about.value = props.profile?.about ?? '';
  coverFile.value = null;
  removeCover.value = false;
  editingAbout.value = false;
  releasePreview();
}

// Профиль пришёл либо обновился после сохранения — поля берутся из него.
watch(() => props.profile, reset, { immediate: true });

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

  //- Рассказ о себе — текстом, как его увидит заказчик; поле только по «Изменить».
  BaseCard.profile-form__about
    .profile-form__about-head
      .profile-form__about-title {{ $t('marketplace.supplierProfileForm.aboutLabel') }}
      BaseButton(v-if="editingAbout", variant="secondary", size="sm", @click="editingAbout = false") {{ $t('marketplace.supplierProfileForm.doneAction') }}
      BaseButton(v-else, variant="secondary", size="sm", @click="editingAbout = true")
        template(#icon-left)
          q-icon(name="edit", size="16px")
        | {{ $t('marketplace.supplierProfileForm.editAboutAction') }}
    BaseInput(
      v-if="editingAbout",
      v-model="about",
      type="textarea",
      :rows="6",
      autogrow,
      autofocus,
      :hint="$t('marketplace.supplierProfileForm.aboutHint', { count: about.length, max: ABOUT_MAX })",
      :error="aboutError"
    )
    .profile-form__about-text(v-else-if="about") {{ about }}
    .profile-form__about-empty(v-else) {{ $t('marketplace.supplierProfileForm.aboutEmpty') }}

  //- Полоса сохранения прибита к низу и видна только при несохранённых правках.
  .profile-form__bar(v-if="dirty")
    BaseButton(variant="ghost", :disabled="saving", @click="reset") {{ $t('common.action.cancel') }}
    BaseButton(variant="primary", :loading="saving", :disabled="!canSave", @click="submit") {{ $t('marketplace.supplierProfileForm.saveAction') }}
</template>

<style scoped lang="scss">
.profile-form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__about-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--p-3);
    margin-bottom: var(--p-3);
  }

  &__about-title {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    letter-spacing: var(--p-ls-h3);
    color: var(--p-ink);
  }

  &__about-text {
    max-width: 72ch;
    font-size: var(--p-fs-body);
    line-height: 1.6;
    color: var(--p-ink);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  &__about-empty {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__bar {
    position: sticky;
    bottom: 0;
    z-index: 1;
    display: flex;
    justify-content: flex-end;
    gap: var(--p-2);
    margin: 0 calc(-1 * var(--p-6)) calc(-1 * var(--p-6));
    padding: var(--p-3) var(--p-6);
    border-top: 1px solid var(--p-line);
    background: var(--p-canvas);
  }
}

@media (max-width: 768px) {
  .profile-form__bar {
    margin: 0 calc(-1 * var(--p-4)) calc(-1 * var(--p-4));
    padding: var(--p-3) var(--p-4);
  }
}
</style>
