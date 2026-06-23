<template lang="pug">
.attach-proof
  .exp-step(v-if='step')
    .exp-step__num {{ step.number }}
    .exp-step__title {{ step.title }}
  .attach-proof__section
    .t-sm.t-muted(v-if='step') Приложите чек об оплате — подтверждение, что платёж исполнен.
    .t-sm.t-muted(v-else) Чек об оплате
    .files(v-if='proofFiles.length')
      button.file-link(
        v-for='file in proofFiles',
        :key='file.id',
        type='button',
        :disabled='openingId === file.id',
        @click='openFile(file)'
      )
        q-icon(name='attach_file', size='16px')
        span {{ fileLabel(file) }}
        q-spinner(v-if='openingId === file.id', size='14px')
    FileUploader(
      v-model='pendingProof',
      accept='image/jpeg,image/png,image/webp,image/heic,application/pdf',
      :max-size='20 * 1024 * 1024',
      title='Приложите чек об оплате',
      hint='Изображение или PDF до 20 МБ — отправится сразу',
      :disabled='uploading'
    )
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { FileUploader } from 'src/shared/ui/domain/FileUploader';
import { api, type IPaymentFile } from '../api';

const props = defineProps<{
  paymentHash: string;
  // Опциональный заголовок-этап (номер + название) для последовательной подачи
  // на столе кассира.
  step?: { number: number | string; title: string };
}>();

const emit = defineEmits<{
  // Срабатывает при загрузке чека — реестр по нему инкрементит отметку proof_count.
  (e: 'uploaded'): void;
}>();

const system = useSystemStore();
const files = ref<IPaymentFile[]>([]);
const pendingProof = ref<File | null>(null);
const uploading = ref(false);

const proofFiles = computed(() => files.value);

async function refresh(): Promise<void> {
  try {
    files.value = await api.loadPaymentProofs(system.info.coopname, props.paymentHash);
  } catch {
    // список файлов — вспомогательный; ошибки загрузки списка не прерывают кассира
    files.value = [];
  }
}

function fileLabel(file: IPaymentFile): string {
  if (file.original_filename) return file.original_filename;
  const date = file.uploaded_at ? new Date(String(file.uploaded_at)).toLocaleString('ru-RU') : '';
  return `Чек от ${date}`;
}

const openingId = ref<number | null>(null);
async function openFile(file: IPaymentFile): Promise<void> {
  try {
    openingId.value = file.id;
    const url = await api.getPaymentFileReadUrl(file.id);
    if (!url) throw new Error('Не удалось получить ссылку на файл');
    window.open(url, '_blank', 'noopener');
  } catch (e) {
    FailAlert(e);
  } finally {
    openingId.value = null;
  }
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function upload(file: File): Promise<void> {
  try {
    uploading.value = true;
    const buffer = await file.arrayBuffer();
    await api.uploadPaymentProof({
      coopname: system.info.coopname,
      payment_hash: props.paymentHash,
      mime_type: file.type,
      size_bytes: file.size,
      checksum_sha256: await sha256Hex(buffer),
      content_base64: toBase64(buffer),
      original_filename: file.name,
    });
    SuccessAlert('Чек об оплате приложен');
    await refresh();
    emit('uploaded');
  } catch (e) {
    FailAlert(e);
  } finally {
    uploading.value = false;
  }
}

// Выбор файла = загрузка: отдельная кнопка «Загрузить» не нужна.
watch(pendingProof, (file) => {
  if (!file || uploading.value) return;
  void upload(file).then(() => {
    pendingProof.value = null;
  });
});

onMounted(refresh);
</script>

<style lang="scss" scoped>
.attach-proof {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.exp-step {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}

.exp-step__num {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: var(--p-r-pill);
  background: var(--p-primary-soft);
  color: var(--p-primary);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.exp-step__title {
  font-weight: 600;
  color: var(--p-ink);
}

.attach-proof__section {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}

.files {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}

.file-link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-primary);
  text-decoration: none;
  font-size: var(--p-fs-body-sm);
  cursor: pointer;
  text-align: left;

  &:hover {
    text-decoration: underline;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}
</style>
