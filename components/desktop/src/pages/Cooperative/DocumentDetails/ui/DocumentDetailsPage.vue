<template lang="pug">
.document-details-page
  //- Липкий бар с кнопкой «Назад» — всегда виден при прокрутке документа.
  .document-details-page__bar
    button.document-back(type='button', @click='goBack')
      q-icon(name='arrow_back', size='18px')
      span К реестру документов

  .document-details-page__content
    div(v-if='loading')
      q-skeleton.q-mb-md.rounded-borders(type='rect', height='220px')
      q-skeleton.q-mb-md.rounded-borders(type='rect', height='140px')

    ComplexDocument(v-else-if='document', :documents='document')

    EmptyState(
      v-else,
      title='Документ не найден',
      body='Проверьте правильность ссылки или вернитесь к реестру документов.'
    )
      template(#icon)
        q-icon(name='search_off', size='48px')
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import { DocumentModel } from 'src/entities/Document';
import { useDesktopStore } from 'src/entities/Desktop';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert } from 'src/shared/api';
import type { IDocumentPackageAggregate } from 'src/entities/Document/model/types';

const route = useRoute();
const router = useRouter();
const documentStore = DocumentModel.useDocumentStore();
const desktopStore = useDesktopStore();
const session = useSessionStore();

const coopname = computed(() => route.params.coopname as string);
const documentHash = computed(() => route.params.hash as string);

const document = ref<IDocumentPackageAggregate | null>(null);
const loading = ref(true);

// Заголовок документа — в шапку (вместо статичного «Документ»).
const documentTitle = computed(() => {
  const meta = (document.value?.statement?.documentAggregate?.document?.meta ??
    document.value?.decision?.documentAggregate?.document?.meta) as Record<string, any> | undefined;
  const title = typeof meta?.title === 'string' ? meta.title : '';
  return title || 'Документ';
});

// Раздел выводим из имени роута (детерминированно даже при холодном deep-link,
// в отличие от activeWorkspaceName, который инициализируется асинхронно).
// Стол совета видит весь документооборот кооператива; пайщик — только свои документы.
const isCouncilDocument = computed(() => route.name === 'document-details');
const scopeUsername = computed(() =>
  isCouncilDocument.value ? coopname.value : session.username,
);
const targetRouteName = computed(() =>
  isCouncilDocument.value ? 'documents' : 'user-documents',
);

// Возврат к реестру документов (back-link под шапкой).
const goBack = (): void => {
  void router.push({
    name: targetRouteName.value,
    params: { coopname: coopname.value },
  });
};

const loadDocument = async (): Promise<void> => {
  loading.value = true;
  try {
    document.value = await documentStore.loadDocument(
      scopeUsername.value,
      documentHash.value,
    );
  } catch (error: any) {
    FailAlert(error);
  } finally {
    loading.value = false;
  }
};

// Наименование документа держим в заголовке шапки, пока открыта страница.
watch(documentTitle, (title) => desktopStore.setPageTitleOverride(title), {
  immediate: true,
});

onMounted(loadDocument);

onUnmounted(() => desktopStore.clearPageTitleOverride());
</script>

<style lang="scss" scoped>
/* Липкий бар во всю ширину — отступы несут бар и контент раздельно.
   top = высота фиксированного топбара (--p-topbar-h), иначе бар уезжает под него. */
.document-details-page__bar {
  position: sticky;
  top: var(--p-topbar-h, 56px);
  z-index: 2;
  background: var(--p-canvas);
  border-bottom: 1px solid var(--p-line);
  padding: var(--p-3, 12px) var(--p-6, 24px);
}

.document-details-page__content {
  padding: var(--p-6, 24px);
}

@media (max-width: 768px) {
  .document-details-page__bar {
    padding: var(--p-3, 12px) var(--p-4, 16px);
  }
  .document-details-page__content {
    padding: var(--p-4, 16px);
  }
}

.document-back {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  cursor: pointer;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.document-back:hover {
  color: var(--p-ink);
}
</style>
