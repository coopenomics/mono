<template lang="pug">
.attach-proof
  .exp-step(v-if='step')
    .exp-step__num {{ step.number }}
    .exp-step__title {{ step.title }}
  //- Секция 1 — платёжка/квитанция об исполненной оплате (для любой механики).
  .attach-proof__section
    .t-sm.t-muted(v-if='step') Приложите платёжку или квитанцию — это подтверждает, что оплата исполнена.
    .t-sm.t-muted(v-else) Платёжка об оплате
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
      title='Приложите платёжку или квитанцию',
      hint='Изображение или PDF до 20 МБ — отправится сразу',
      :disabled='uploading'
    )

  //- Секция 2 — закрывающие документы организации (только прямая оплата по счёту).
  .attach-proof__section(v-if='isDirect')
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
  // Опциональный заголовок-этап (номер + название) для последовательной подачи
  // на столе кассира.
  step?: { number: number | string; title: string };
}>();

const emit = defineEmits<{
  // Срабатывает только при загрузке ПЛАТЁЖКИ — реестр по ней инкрементит отметку
  // proof_count (закрывающие документы на эту отметку не влияют).
  (e: 'uploaded'): void;
}>();

const system = useSystemStore();
const files = ref<IExpenseFile[]>([]);
const pendingProof = ref<File | null>(null);
const pendingClosing = ref<File | null>(null);
const uploading = ref(false);
const mechanics = ref<Zeus.ExpenseMechanics | null>(null);

const isDirect = computed(() => mechanics.value === Zeus.ExpenseMechanics.DIRECT);
const proofFiles = computed(() =>
  files.value.filter((f) => f.kind === Zeus.ExpenseFileKind.PAYMENT_PROOF),
);
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
    // список файлов — вспомогательный; ошибки загрузки списка не прерывают кассира
    files.value = [];
  }
}

function fileLabel(file: IExpenseFile): string {
  if (file.original_filename) return file.original_filename;
  const date = file.uploaded_at ? new Date(String(file.uploaded_at)).toLocaleString('ru-RU') : '';
  return `Документ от ${date}`;
}

// Списочные запросы файлов отдают записи без read_url (он короткоживущий) —
// свежая ссылка запрашивается по id в момент клика и сразу открывается.
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

async function upload(file: File, kind: Zeus.ExpenseFileKind): Promise<void> {
  try {
    uploading.value = true;
    const buffer = await file.arrayBuffer();
    await api.uploadExpenseFile({
      coopname: system.info.coopname,
      proposal_hash: props.proposalHash,
      item_hash: props.itemHash,
      kind,
      mime_type: file.type,
      size_bytes: file.size,
      checksum_sha256: await sha256Hex(buffer),
      content_base64: toBase64(buffer),
      original_filename: file.name,
    });
    SuccessAlert(
      kind === Zeus.ExpenseFileKind.PAYMENT_PROOF
        ? 'Платёжка приложена'
        : 'Закрывающий документ приложен',
    );
    await refresh();
    // proof_count в реестре считает только платёжки.
    if (kind === Zeus.ExpenseFileKind.PAYMENT_PROOF) emit('uploaded');
  } catch (e) {
    FailAlert(e);
  } finally {
    uploading.value = false;
  }
}

// Выбор файла = загрузка: отдельная кнопка «Загрузить» не нужна.
watch(pendingProof, (file) => {
  if (!file || uploading.value) return;
  void upload(file, Zeus.ExpenseFileKind.PAYMENT_PROOF).then(() => {
    pendingProof.value = null;
  });
});
watch(pendingClosing, (file) => {
  if (!file || uploading.value) return;
  void upload(file, Zeus.ExpenseFileKind.CLOSING_DOC).then(() => {
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
