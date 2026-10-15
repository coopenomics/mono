<template lang="pug">
div
  .upload-area(
    :class='{ "upload-area--dragover": isDragOver }',
    @dragover.prevent='onDragOver',
    @dragleave.prevent='onDragLeave',
    @drop.prevent='onDrop'
  )
    .upload-content
      q-icon(name='cloud_upload', size='48px', color='grey-6')
      .upload-text {{ $t('capital.csvUploader.title') }}
      .upload-subtext
        | {{ $t('capital.csvUploader.dragHint') }}
        q-btn(
          glossy,
          dense,
          size='sm',
          color='primary',
          :label='$t("capital.csvUploader.chooseFileButton")',
          @click='fileInput?.click()'
        )

      input(
        ref='fileInput',
        type='file',
        accept='.csv',
        @change='onFileSelected',
        style='display: none'
      )

  .file-info(v-if='selectedFile')
    .file-info-content
      .file-name
        q-icon(name='description', size='20px')
        span {{ selectedFile.name }}
      .file-size ({{ formatFileSize(selectedFile.size) }})
      q-btn(
        flat,
        dense,
        color='negative',
        icon='delete',
        @click='clearFile',
        :label='$t("common.action.delete")'
      )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCsvParser } from 'app/extensions/capital/shared/lib/composables/useCsvParser';
import { SuccessAlert, FailAlert, NotifyAlert } from 'src/shared/api';
import { t } from '../../i18n';

interface Emits {
  (e: 'parsed', data: any[]): void;
}

const emit = defineEmits<Emits>();

const { parseCsv } = useCsvParser();
const selectedFile = ref<File | null>(null);
const isDragOver = ref(false);
const fileInput = ref<HTMLInputElement>();

const onDragOver = () => {
  isDragOver.value = true;
};

const onDragLeave = () => {
  isDragOver.value = false;
};

const onDrop = (event: DragEvent) => {
  isDragOver.value = false;
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    selectFile(files[0]);
  }
};

const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (files && files.length > 0) {
    selectFile(files[0]);
  }
};

const selectFile = async (file: File) => {
  if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
    NotifyAlert(t('capital.csvUploader.invalidTypeError'));
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    // 10MB
    FailAlert(t('capital.csvUploader.tooLargeError'));

    return;
  }

  selectedFile.value = file;

  // Автоматически начинаем парсинг файла
  await parseFile();
};

const clearFile = () => {
  selectedFile.value = null;

  // Сбрасываем input
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const parseFile = async () => {
  if (!selectedFile.value) return;

  try {
    const data = await parseCsv(selectedFile.value);
    emit('parsed', data);

    SuccessAlert(t('capital.csvUploader.parsedSuccess', { count: data.length }));
  } catch (error: any) {
    FailAlert(t('capital.csvUploader.parseError', { error: error.message }));
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
</script>

<style lang="scss" scoped>
.upload-area {
  border: 2px dashed #e0e0e0;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    border-color: #1976d2;
  }

  &--dragover {
    border-color: #1976d2;
  }
}

.upload-content {
  .upload-text {
    font-size: 18px;
    font-weight: 500;
    margin: 16px 0 8px 0;
    // color: rgba(0, 0, 0, 0.87);
  }

  .upload-subtext {
    font-size: 14px;
    // color: rgba(0, 0, 0, 0.6);
    margin-bottom: 16px;
  }
}

.file-info {
  margin-top: 16px;
  padding: 16px;
  border-radius: 4px;

  &-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .file-name {
    display: flex;
    align-items: center;
    gap: 8px;

    span {
      font-weight: 500;
    }
  }

  .file-size {
    font-size: 14px;
  }
}

.upload-actions {
  margin-top: 16px;
  text-align: center;
}

.csv-info {
  margin-top: 24px;
  padding: 16px;
  border-radius: 4px;
  border-left: 4px solid #1976d2;

  .info-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: #1976d2;
  }

  .info-list {
    .info-item {
      margin-bottom: 4px;
      font-size: 14px;

      strong {
        color: #1976d2;
      }

      span {
        margin-left: 4px;
      }
    }
  }
}

.q-btn {
  margin: 0 4px;
}
</style>
