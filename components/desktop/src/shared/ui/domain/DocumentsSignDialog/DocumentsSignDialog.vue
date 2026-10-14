<template lang="pug">
//- Хост единого окна подписи: вид как у подписи соглашений при входе —
//- развёрнутое окно, документ в карточке по центру, кнопки в подвале.
//- Документы идут по одному: «Продолжить», на последнем — «Подписать».
BaseDialog(
  :model-value='Boolean(pending)',
  :title='pending?.request.title ?? $t("ui.documentsSignDialog.title")',
  maximized,
  :close-on-backdrop='false',
  @update:model-value='(v) => !v && cancel()'
)
  .row.justify-center(v-if='pending && current')
    BaseCard.col-md-8.col-xs-12
      .documents-sign__step
        span.documents-sign__eyebrow {{ $t('ui.documentsSignDialog.stepText', { current: index + 1, total: total }) }}
        span.documents-sign__name {{ current.title }}
      DocumentHtmlReader(:key='current.key', :html='current.document.html', profile='document')

  template(#footer)
    .documents-sign__actions
      BaseButton(v-if='index > 0', variant='ghost', :disabled='signing', @click='index -= 1') {{ $t('ui.documentsSignDialog.backLabel') }}
      BaseButton(v-if='!isLast', variant='primary', @click='index += 1') {{ $t('ui.documentsSignDialog.continueLabel') }}
      BaseButton(v-else, variant='primary', :loading='signing', @click='sign') {{ $t('ui.documentsSignDialog.signLabel') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { ensureSigningUnlocked, signDocument } from 'src/shared/lib/document';
import { pendingSignRequest, settleSignRequest, type SignedDocumentsMap } from 'src/shared/lib/sign-documents';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseCard } from 'src/shared/ui/base/BaseCard';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';

const session = useSessionStore();
const pending = pendingSignRequest;
const index = ref(0);
const signing = ref(false);

const total = computed(() => pending.value?.request.documents.length ?? 0);
const current = computed(() => pending.value?.request.documents[index.value] ?? null);
const isLast = computed(() => index.value >= total.value - 1);

// Новый запрос начинается с первого документа.
watch(pending, () => {
  index.value = 0;
  signing.value = false;
});

function cancel(): void {
  if (signing.value) return;
  settleSignRequest(null);
}

// Ключ отпирается один раз на всю серию; подписываются прочитанные экземпляры по порядку.
async function sign(): Promise<void> {
  const request = pending.value?.request;
  if (!request) return;
  if (!(await ensureSigningUnlocked())) return;
  signing.value = true;
  try {
    const signed: SignedDocumentsMap = {};
    for (const item of request.documents) {
      signed[item.key] = await signDocument(item.document, session.username, item.signatureId ?? 1, item.existing);
    }
    settleSignRequest(signed);
  } catch (e) {
    FailAlert(e);
  } finally {
    signing.value = false;
  }
}
</script>

<style scoped lang="scss">
.documents-sign__step {
  display: flex;
  align-items: baseline;
  gap: var(--p-2);
  margin-bottom: var(--p-4);
}

.documents-sign__eyebrow {
  color: var(--p-ink-2);
  font-size: var(--p-fs-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
  white-space: nowrap;
}

.documents-sign__name {
  font-size: var(--p-fs-h3);
  font-weight: 600;
}

/* Кнопки в подвале окна — вне прокрутки документа, видны всегда и на телефоне. */
.documents-sign__actions {
  width: 100%;
  display: flex;
  justify-content: center;
  gap: var(--p-2);
}
</style>
