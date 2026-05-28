<template lang="pug">
q-card.dynamic-padding(
  :flat='isMobile',
  style='word-break: break-all !important; white-space: normal !important'
)
  .base-document__loader(v-if='loading')
    q-spinner(color='primary', size='32px')
    span.base-document__loader-label Формируем документ{{ doc?.meta?.title ? ` «${doc.meta.title}»` : '' }}…
  div(v-if='!loading')
    ShadowHtml(:html='safeHtml', :styles='shadowStyles')
    .row.q-mt-lg.q-pa-sm.justify-center
      .col-md-8.col-xs-12
        //- Кнопка «Сверить» (локальная пересборка + сверка хеша) временно скрыта
        //- через :hide-verify. Чтобы вернуть — убрать :hide-verify (обработчик @verify
        //- остаётся подключённым).
        DocumentSignatures(
          :doc-hash='documentAggregate?.document?.doc_hash ?? ""',
          :regenerated-hash='regeneratedHash',
          :signatures='canonSignatures',
          :verifying='onRegenerate',
          :hide-verify='true',
          @download='download',
          @verify='regenerate'
        )
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useGlobalStore } from 'src/shared/store';
import DOMPurify from 'dompurify';
import { DigitalDocument, prepareDocumentArchive } from 'src/shared/lib/document';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useWindowSize } from 'src/shared/hooks';
import type { IDocumentAggregate } from 'src/entities/Document/model';
import { getNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { ShadowHtml } from '../ShadowHtml';
import { DocumentSignatures, type DocumentSignatureEntry } from 'src/shared/ui/domain/DocumentSignatures';

const props = defineProps({
  documentAggregate: {
    type: Object as () => IDocumentAggregate,
    required: true,
  },
});

const doc = computed(() => props.documentAggregate.rawDocument);

const loading = ref(false);
const { isMobile } = useWindowSize();
const regeneratedHash = ref();
const onRegenerate = ref(false);
const regenerated = ref();

const regenerate = async () => {
  try {
    onRegenerate.value = true;

    regenerated.value = await new DigitalDocument().generate(
      { ...doc.value?.meta },
      { skip_save: true },
    );

    if (regenerated.value.hash == regeneratedHash.value)
      SuccessAlert(
        'Сверка прошла успешно: аналогичный документ восстановлен из исходных данных',
      );
    else
      FailAlert(
        'Сверка прошла безуспешно: аналогичный документ невозможно получить из исходных данных',
      );

    onRegenerate.value = false;
  } catch {
    onRegenerate.value = false;
  }
};

// Функция для декодирования и очистки HTML
function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['style'],
    ADD_ATTR: ['class', 'id'],
  });
}

const safeHtml = computed(() => sanitizeHtml(doc.value?.html ?? ''));

// Стили для Shadow DOM
const shadowStyles = computed(
  () =>
    `
  /* Универсальные стили для всех таблиц */
  table {
    width: 100%;
    border-collapse: collapse;
    word-break: break-word;
    table-layout: auto;
  }

  th, td {
    border: 1px solid #ccc;
    padding: 8px;
    text-align: left;
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-all !important;
    white-space: normal !important;
  }

  th {
    width: 30% !important;
    max-width: 30% !important;
    word-break: break-word !important;
  }

  tr {
    word-break: break-word;
  }

  /* Стили для description класса */
  td {
    word-break: break-all !important;
    word-wrap: break-word !important;
    white-space: normal !important;
  }

  .digital-document .header {
    text-align: center;
  }

  .digital-document {
    word-break: break-word !important;
    white-space: pre-wrap;
  }

   table {
    width: 100%;
    border-collapse: collapse;
  }

   th,
   td {
    border: 1px solid #ccc;
    padding: 8px;
    text-align: left;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

   th {
    width: 30% !important;
    max-width: 30% !important;
    word-break: break-word !important;
    background: none !important;
  }

  /* Quasar таблицы */
  .q-table--no-wrap th,
  .q-table--no-wrap td {
    white-space: break-spaces !important;
    word-break: break-word !important;
  }
`,
);

const hashBuffer = async () => {
  try {
    // Декодирование из base64
    const binaryString = atob(doc.value?.binary ?? '');
    const len = binaryString.length;
    const data = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      data[i] = binaryString.charCodeAt(i);
    }

    // Вычисление хэша из декодированных бинарных данных
    regeneratedHash.value = (
      await useGlobalStore().hashMessage(data)
    ).toUpperCase();
    console.log('Хэш успешно вычислен:', regeneratedHash.value);
  } catch (error) {
    console.error('Ошибка при вычислении хэша:', error);
  }
};

// Получение ФИО/названия подписанта по сертификату
const getSignerName = (signer_certificate: any) => {
  if (!signer_certificate) return 'Неизвестный подписант';
  return getNameFromCertificate(signer_certificate) || 'Неизвестный подписант';
};

// Верификация всех подписей из агрегата
const verifySignatures = () => {
  // if (props.documentAggregate?.document?.signatures?.length > 0) {
  //   signatures_verified.value = props.documentAggregate.document.signatures.map(signatureData => {
  //     try {
  //       if (signatureData.public_key && signatureData.signature) {
  //         const public_key = PublicKey.from(signatureData.public_key)
  //         const signature = Signature.from(signatureData.signature)
  //         const hash = doc.value?.hash
  //         const is_valid = signature.verifyDigest(hash, public_key)
  //         return is_valid
  //       } else {
  //         return signatureData.is_valid
  //       }
  //     } catch (error) {
  //       console.error('Ошибка при верификации подписи:', error)
  //       return false
  //     }
  //   })
  // }
};

onMounted(() => {
  hashBuffer();
  verifySignatures();
});

async function download() {
  try {
    loading.value = true;
    const { blob, archiveName } = await prepareDocumentArchive(
      props.documentAggregate,
    );

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${archiveName}.zip`;

    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  } catch (error) {
    console.error('Ошибка при скачивании файла:', error);
    FailAlert('Не удалось подготовить архив документа');
  } finally {
    loading.value = false;
  }
}

// Адаптер реальной модели подписи документа (signer_certificate + public_key
// + signature + is_valid из IDocumentAggregate) в форму, которую ждёт canon-
// компонент DocumentSignatures (signerName + publicKey + signature + isValid).
// signer_certificate резолвится через getNameFromCertificate — caller знает
// формат сертификата, canon-компонент остаётся props-only и не лезет в типы.
const canonSignatures = computed<DocumentSignatureEntry[]>(() =>
  (props.documentAggregate?.document?.signatures ?? []).map((s) => ({
    signerName: getSignerName(s.signer_certificate),
    publicKey: s.public_key,
    signature: s.signature,
    isValid: s.is_valid ?? undefined,
  })),
);
</script>
<style>
@media (min-width: 700px) {
  .dynamic-padding {
    padding: 50px !important;
  }
}
@media (max-width: 700px) {
  .dynamic-padding {
    padding: 10px !important;
  }
}

.base-document__loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--p-3, 12px);
  min-height: 360px;
  width: 100%;
  text-align: center;
}

.base-document__loader-label {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.5);
  max-width: 480px;
}
</style>
