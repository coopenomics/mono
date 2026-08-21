<template lang="pug">
//- Сверка личности с документом перед подтверждением. Данные пайщика
//- запрашиваются у сервера в момент открытия окна: постоянного доступа к
//- персональным данным ни у оператора участка, ни у совета нет.
VerificationConfirmDialog(
  :model-value='modelValue',
  :full-name='identity?.full_name || fullName',
  :username='username',
  :hint='hint',
  size='md',
  :loading='verifying',
  :confirm-disabled='!canConfirm',
  @update:model-value='(value) => emit("update:modelValue", value)',
  @confirm='onConfirm'
)
  .verify-dialog__facts(v-if='loadingIdentity')
    q-skeleton(type='text', width='70%')
    q-skeleton(type='text', width='55%')
    q-skeleton(type='text', width='60%')
  .verify-dialog__facts(v-else-if='facts.length')
    DataRow(
      v-for='fact in facts',
      :key='fact.label',
      :label='fact.label',
      :value='fact.value',
      :align='fact.wide ? "vertical" : "horizontal"'
    )

  //- Фотофиксация нужна там, где сверку потом проверяет совет — на участке.
  //- Совет сверяет сам и себя не проверяет, поэтому снимки у него не просим.
  .verify-dialog__photos(v-if='braname')
    .verify-dialog__photos-title Фотографии сверки
    FileUploader(
      v-model='photos',
      accept='image/*',
      capture='environment',
      multiple,
      :max-files='PHOTOS_MAX',
      :max-size='PHOTO_MAX_BYTES',
      :disabled='verifying',
      title='Снимите пайщика с паспортом',
      hint='Пайщик держит раскрытый паспорт у лица. Снимки хранятся до решения совета и затем удаляются',
      @error='onPhotoError'
    )
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DataRow, FileUploader, VerificationConfirmDialog } from 'src/shared/ui/domain';
import type { FileUploaderError } from 'src/shared/ui/domain/FileUploader';
import { FailAlert } from 'src/shared/api';
import { formatDocumentDate } from 'src/shared/lib/utils/dates';
import { readFileForUpload } from 'src/shared/lib/utils';
import { verificationHint, verificationIdentityFacts } from 'src/shared/lib/verification';
import { api, type IParticipantIdentity } from '../api';
import { useVerifyIdentity } from '../model';

/** Столько снимков принимает сервер за одну сверку. */
const PHOTOS_MAX = 5;
/** Предел на снимок — тот же, что у бакета `coopid:verification`. */
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const props = defineProps<{
  modelValue: boolean;
  /** Имя аккаунта пайщика, чью личность сверяют. */
  username: string;
  /** ФИО из уже загруженных данных — показываем, пока грузится сверка. */
  fullName?: string;
  /** Участок, где идёт сверка; пусто — сверяет совет кооператива. */
  braname?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'verified'): void;
}>();

const { verify, loading: verifying } = useVerifyIdentity();
const identity = ref<IParticipantIdentity | null>(null);
const loadingIdentity = ref(false);
const photos = ref<File[]>([]);

const facts = computed(() =>
  identity.value ? verificationIdentityFacts(identity.value, formatDocumentDate) : [],
);

const hint = computed(() => verificationHint(identity.value?.type ?? ''));

// На участке без снимка подтверждать нечего: совету потом не по чему решать,
// а сервер такую сверку и не примет.
const canConfirm = computed(() => !props.braname || photos.value.length > 0);

// Данные грузим на открытие окна и забываем на закрытие: они нужны ровно на
// время сверки. Отказ сервера (личность уже подтверждена, нет полномочий)
// закрывает окно — показывать пустую форму подтверждения нечестно.
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      identity.value = null;
      photos.value = [];
      return;
    }
    loadingIdentity.value = true;
    try {
      identity.value = await api.getIdentityForVerification({
        username: props.username,
        ...(props.braname ? { braname: props.braname } : {}),
      });
    } catch (error: any) {
      FailAlert(error);
      emit('update:modelValue', false);
    } finally {
      loadingIdentity.value = false;
    }
  },
);

const onPhotoError = (error: FileUploaderError) => {
  FailAlert(error.message);
};

const onConfirm = async () => {
  const attachments = await Promise.all(photos.value.map((file) => readFileForUpload(file)));
  if (await verify(props.username, props.braname, attachments)) {
    emit('update:modelValue', false);
    emit('verified');
  }
};
</script>

<style scoped lang="scss">
.verify-dialog__facts {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
}

.verify-dialog__photos {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  margin-top: var(--p-3, 12px);
}

.verify-dialog__photos-title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}
</style>
