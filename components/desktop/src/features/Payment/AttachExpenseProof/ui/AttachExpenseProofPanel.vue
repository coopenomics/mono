<template lang="pug">
//- Закрывающие документы организации (акт, счёт-фактура, накладная) — только
//- прямая оплата по счёту (DIRECT). Чек об оплате теперь общий, в ядре
//- (AttachPaymentProofPanel по payment_hash) — здесь остаётся expense-специфика.
.attach-proof(v-if='isDirect')
  .attach-proof__section
    .t-sm.t-muted Закрывающие документы (акт, счёт-фактура, накладная)
    .files(v-if='closingFiles.length')
      button.file-link(
        v-for='file in closingFiles',
        :key='file.id',
        type='button',
        :disabled='openingId === file.id',
        @click='openFile(file)'
      )
        q-icon(name='attach_file', size='16px')
        span {{ fileLabel(file) }}
        q-spinner(v-if='openingId === file.id', size='14px')
    FileUploader(
      v-model='pendingClosing',
      accept='image/jpeg,image/png,image/webp,image/heic,application/pdf',
      :max-size='20 * 1024 * 1024',
      title='Приложите закрывающий документ',
      hint='Можно несколько — каждый отправится сразу',
      :disabled='uploading'
    )
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSystemStore } from 'src/entities/System/model';
import { FileUploader } from 'src/shared/ui/domain/FileUploader';
import { api, type IExpenseFile } from '../api';

const props = defineProps<{
  proposalHash: string;
  itemHash: string;
}>();

const system = useSystemStore();
const files = ref<IExpenseFile[]>([]);
const pendingClosing = ref<File | null>(null);
const uploading = ref(false);
const mechanics = ref<Zeus.ExpenseMechanics | null>(null);

const isDirect = computed(() => mechanics.value === Zeus.ExpenseMechanics.DIRECT);
const closingFiles = computed(() =>
  files.value.filter((f) => f.kind === Zeus.ExpenseFileKind.CLOSING_DOC),
);

async function refresh(): Promise<void> {
  try {
    files.value = await api.loadExpenseFilesByItem(
      system.info.coopname,
      props.proposalHash,
      props.itemHash,
    );
  } catch {
    files.value = [];
  }
}

function fileLabel(file: IExpenseFile): string {
  if (file.original_filename) return file.original_filename;
  const date = file.uploaded_at ? new Date(String(file.uploaded_at)).toLocaleString('ru-RU') : '';
  return `Документ от ${date}`;
}

const openingId = ref<number | null>(null);
async function openFile(file: IExpenseFile): Promise<void> {
  try {
    openingId.value = file.id;
    const url = await api.getExpenseFileReadUrl(file.id);
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
    await api.uploadExpenseFile({
      coopname: system.info.coopname,
      proposal_hash: props.proposalHash,
      item_hash: props.itemHash,
      kind: Zeus.ExpenseFileKind.CLOSING_DOC,
      mime_type: file.type,
      size_bytes: file.size,
      checksum_sha256: await sha256Hex(buffer),
      content_base64: toBase64(buffer),
      original_filename: file.name,
    });
    SuccessAlert('Закрывающий документ приложен');
    await refresh();
  } catch (e) {
    FailAlert(e);
  } finally {
    uploading.value = false;
  }
}

watch(pendingClosing, (file) => {
  if (!file || uploading.value) return;
  void upload(file).then(() => {
    pendingClosing.value = null;
  });
});

onMounted(async () => {
  await refresh();
  try {
    mechanics.value = await api.loadItemMechanics(props.proposalHash, props.itemHash);
  } catch {
    mechanics.value = null;
  }
});
</script>

<style lang="scss" scoped>
.attach-proof {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
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
