<template lang="pug">
//- Пока документ формируется, рамку-карточку не показываем: висячая пустая
//- рамка вокруг спиннера выглядит как сломанный блок. Рамка появляется
//- вместе с готовым документом.
q-card.dynamic-padding(
  :flat='isMobile || loading',
  :class='{ "base-document--generating": loading }',
  style='word-break: break-all !important; white-space: normal !important'
)
  .base-document__loader(v-if='loading')
    q-spinner(color='primary', size='32px')
    span.base-document__loader-label Формируем документ{{ doc?.meta?.title ? ` «${doc.meta.title}»` : '' }}…
  div(v-if='!loading')
    ShadowHtml(:html='safeHtml', :styles='shadowStyles')
    //- Блок контрольной суммы/подписей/скачивания показываем только у документов
    //- с каноническим doc_hash (подписанные/зарегистрированные). Неподписанное
    //- превью строится с пустым doc_hash — там сверять и скачивать нечего, блок прячем.
    .row.q-mt-lg.q-pa-sm.justify-center(v-if='hasDocHash')
      .col-md-8.col-xs-12
        //- Кнопка «Сверить» (локальная пересборка + сверка хеша) временно скрыта
        //- через :hide-verify. Чтобы вернуть — убрать :hide-verify (обработчик @verify
        //- остаётся подключённым).
        DocumentSignatures(
          :doc-hash='documentAggregate?.document?.doc_hash ?? ""',
          :regenerated-hash='regeneratedHash',
          :hash-loading='hashComputing',
          :signatures='canonSignatures',
          :verifying='onRegenerate',
          :hide-verify='true',
          @download='download',
          @verify='regenerate'
        )
</template>
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
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

// Неподписанное превью строится с пустым doc_hash (канонического хэша ещё нет):
// сверять не с чем, поэтому блок контрольной суммы скрываем и локальный пересчёт
// не запускаем. Для реальных подписанных документов doc_hash присутствует → сверка работает.
const hasDocHash = computed(() => !!props.documentAggregate?.document?.doc_hash);

const loading = ref(false);
const { isMobile } = useWindowSize();
const regeneratedHash = ref<string | undefined>();
const hashComputing = ref(false);
const onRegenerate = ref(false);
const regenerated = ref();

let hashRequestId = 0;

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

// Функция для декодирования и очистки HTML.
//
// WHOLE_DOCUMENT: true — иначе DOMPurify вырезает содержимое <style> целиком
// (сам тег остаётся в списке разрешённых через ADD_TAGS, но его текстовый
// узел стирается), даже с ADD_TAGS: ['style']. Проверено эмпирически. В
// WHOLE_DOCUMENT-режиме DOMPurify оборачивает результат в <html><head>...
// <style>...</style></head><body>...</body></html> и содержимое style
// выживает. Обёртка html/head/body безвредна: при вставке через
// `shadowRoot.innerHTML` (см. ShadowHtml.vue) браузер разбирает её по
// алгоритму fragment-парсинга и просто не создаёт сами теги html/head/body,
// а их содержимое (включая <style>) остаётся в дереве shadow-root — CSS
// оттуда действует на всё поддерево независимо от вложенности. Благодаря
// этому шаблонам документов больше не нужно держать в уме, что этот
// компонент форсит pre-wrap и стирает их <style> — можно писать вёрстку один
// раз, единообразно для PDF (weasyprint) и предпросмотра.
function sanitizeHtml(html: string) {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['style'],
    ADD_ATTR: ['class', 'id'],
    WHOLE_DOCUMENT: true,
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

  /* Заголовок документа (h1) — всегда по центру. Документы задают это в своём
     <style>, но DOMPurify вырезает содержимое <style>-блока (инлайн-стили
     выживают, блочные правила — нет), поэтому центрирование заголовка держим
     здесь, в shadowStyles, — этот канал инжектится мимо санитайзера. h3 НЕ
     трогаем: это левые подзаголовки секций (ЧЛЕНЫ СОВЕТА, ПОВЕСТКА и т.п.). */
  .digital-document h1 {
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
  const binary = doc.value?.binary;
  if (!binary) {
    regeneratedHash.value = undefined;
    hashComputing.value = hasDocHash.value;
    return;
  }

  const requestId = ++hashRequestId;
  hashComputing.value = true;

  try {
    const binaryString = atob(binary);
    const len = binaryString.length;
    const data = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      data[i] = binaryString.charCodeAt(i);
    }

    const hash = (await useGlobalStore().hashMessage(data)).toUpperCase();
    if (requestId !== hashRequestId) return;

    regeneratedHash.value = hash;
  } catch (error) {
    if (requestId !== hashRequestId) return;
    regeneratedHash.value = undefined;
    console.error('Ошибка при вычислении хэша:', error);
  } finally {
    if (requestId === hashRequestId) {
      hashComputing.value = false;
    }
  }
};

watch(
  () => (hasDocHash.value ? doc.value?.binary : undefined),
  (binary, prevBinary) => {
    if (binary === prevBinary) return;
    regeneratedHash.value = undefined;
    if (hasDocHash.value) void hashBuffer();
  },
  { immediate: true },
);

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

verifySignatures();

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

/* Без рамки/фона на время генерации — flat-проп убирает тень, но не
   hairline-границу канона; transparent, чтобы спиннер висел прямо на канвасе. */
.base-document--generating {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
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
