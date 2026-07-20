<template lang="pug">
BaseCard.capital-doc-params(title='Параметры документов ЦПП')
  p.t-body-sm.capital-doc-params__intro
    | Заполните параметры положений «ГЕНЕРАТОР» и «БЛАГОРОСТ» прямо в тексте документа.

  q-tabs(v-model='activeTab' dense align='left' class='capital-doc-params__tabs')
    q-tab(
      v-for='section in DOCUMENT_SECTIONS'
      :key='section.registryId'
      :name='section.registryId'
      :label='section.tabLabel'
    )
      q-badge(v-if='getMissingCount(section.registryId)' color='warning' floating) {{ getMissingCount(section.registryId) }}

  q-tab-panels(v-model='activeTab' animated class='capital-doc-params__panels')
    q-tab-panel(
      v-for='section in DOCUMENT_SECTIONS'
      :key='section.registryId'
      :name='section.registryId'
    )
      .capital-doc-params__toolbar
        BaseButton(
          color='primary'
          outline
          :loading='loadingRegistryId === section.registryId'
          :disable='!!loadingRegistryId'
          @click='loadPreview(section.registryId)'
        )
          q-icon(name='refresh' class='q-mr-xs')
          | {{ previews[section.registryId] ? 'Обновить предпросмотр' : 'Сформировать предпросмотр' }}

      q-inner-loading(:showing='loadingRegistryId === section.registryId')

      CapitalProgramInlineDocumentPreview(
        v-if='previews[section.registryId]'
        v-model='form'
        :html='getPreviewHtml(section.registryId)'
        :field-labels='FIELD_LABELS'
        class='q-mt-md'
      )

      p.t-caption.text-grey-6.q-mt-md(v-else)
        | Нажмите «Сформировать предпросмотр», чтобы увидеть документ с редактируемыми полями.

  .capital-doc-params__footer
    BaseButton(
      color='primary'
      :loading='saving'
      :disable='!!loadingRegistryId'
      @click='saveParams'
    )
      | Сохранить параметры
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import type { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { BaseButton, BaseCard } from 'src/shared/ui/base';
import { api as documentApi } from 'src/shared/lib/document/api';
import { api } from '../api';
import CapitalProgramInlineDocumentPreview from './CapitalProgramInlineDocumentPreview.vue';
import {
  ALL_DOC_FIELDS,
  BLAGOROST_DOC_FIELDS,
  DOCUMENT_SECTIONS,
  FIELD_LABELS,
  GENERATOR_DOC_FIELDS,
  PREVIEW_PLACEHOLDER,
  type EditableFieldKey,
} from '../model/capitalProgramDocFields';
import {
  getCapitalProgramDocParamsDraftKey,
  readCapitalProgramDocParamsDraft,
  writeCapitalProgramDocParamsDraft,
} from '../model/useCapitalProgramDocParamsDraft';

const emit = defineEmits<{
  saved: [hash: string];
}>();

const $q = useQuasar();
const systemStore = useSystemStore();
const sessionStore = useSessionStore();

const activeTab = ref<number>(994);
const saving = ref(false);
const savedHash = ref('');
const loadingRegistryId = ref<number | null>(null);

type PreviewState = {
  html: string;
  docDataHash: string;
};

const previews = reactive<Partial<Record<number, PreviewState>>>({});

const DOC_FIELDS_BY_REGISTRY: Record<number, EditableFieldKey[]> = {
  994: GENERATOR_DOC_FIELDS,
  998: BLAGOROST_DOC_FIELDS,
};

function createEmptyForm(): Record<EditableFieldKey, string> {
  return Object.fromEntries(ALL_DOC_FIELDS.map((key) => [key, ''])) as Record<EditableFieldKey, string>;
}

const form = reactive<Record<EditableFieldKey, string>>(createEmptyForm());

const draftStorageKey = computed(() =>
  getCapitalProgramDocParamsDraftKey(systemStore.info?.coopname ?? '', sessionStore.username ?? ''),
);

function restoreDraftFromStorage() {
  const draft = readCapitalProgramDocParamsDraft(draftStorageKey.value);
  if (!draft) return;

  Object.assign(form, draft.form);
  savedHash.value = draft.savedHash;
  Object.assign(previews, draft.previews);
  activeTab.value = draft.activeTab ?? 994;
}

function persistDraftToStorage() {
  writeCapitalProgramDocParamsDraft(draftStorageKey.value, {
    form: { ...form },
    activeTab: activeTab.value,
    savedHash: savedHash.value,
    previews: { ...previews },
  });
}

const editableFields = computed(() =>
  ALL_DOC_FIELDS.map((key) => ({
    key,
    label: FIELD_LABELS[key],
  })),
);

function getPreviewHtml(registryId: number): string {
  return previews[registryId]?.html ?? '';
}

function getMissingCount(registryId: number): number {
  const fields = DOC_FIELDS_BY_REGISTRY[registryId] ?? [];
  return fields.filter((key) => !String(form[key] ?? '').trim()).length;
}

function getPreviewPayload(): Cooperative.Registry.CapitalProgramPrivateData {
  return Object.fromEntries(
    ALL_DOC_FIELDS.map((key) => [key, String(form[key] ?? '').trim() || PREVIEW_PLACEHOLDER]),
  ) as Record<EditableFieldKey, string>;
}

function getDocDataHashFromResult(result: Awaited<ReturnType<typeof documentApi.generateDocument>>): string {
  const meta = result.meta as { doc_data_hash?: string } | undefined;
  return meta?.doc_data_hash ?? '';
}

function validatePayload(): string | null {
  const missing = editableFields.value
    .filter(({ key }) => !String(form[key] ?? '').trim())
    .map(({ label }) => label);

  if (missing.length) {
    return `Заполните все параметры в документах: ${missing.join(', ')}`;
  }

  return null;
}

async function loadPreview(registryId: number, options?: { silent?: boolean }) {
  if (!options?.silent) {
    loadingRegistryId.value = registryId;
  }

  try {
    const result = await documentApi.generateDocument({
      coopname: systemStore.info?.coopname ?? '',
      username: sessionStore.username ?? '',
      registry_id: registryId,
      doc_data: getPreviewPayload(),
    });

    previews[registryId] = {
      html: result.html,
      docDataHash: getDocDataHashFromResult(result),
    };
    persistDraftToStorage();

    return result;
  } catch (error) {
    if (!options?.silent) {
      $q.notify({
        type: 'negative',
        message: error instanceof Error ? error.message : 'Не удалось сформировать предпросмотр',
      });
    }
    throw error;
  } finally {
    if (!options?.silent) {
      loadingRegistryId.value = null;
    }
  }
}

async function saveParams() {
  const validationError = validatePayload();
  if (validationError) {
    $q.notify({ type: 'warning', message: validationError });
    return;
  }

  saving.value = true;

  try {
    for (const section of DOCUMENT_SECTIONS) {
      await loadPreview(section.registryId, { silent: true });
    }

    const hash = previews[994]?.docDataHash ?? previews[998]?.docDataHash;
    if (!hash) {
      throw new Error('Не удалось получить хеш параметров документов');
    }

    await api.saveProgramDocDataHash({ doc_data_hash: hash });

    savedHash.value = hash;
    emit('saved', hash);

    $q.notify({
      type: 'positive',
      message: 'Параметры документов ЦПП сохранены',
    });
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: error instanceof Error ? error.message : 'Не удалось сохранить параметры',
    });
  } finally {
    saving.value = false;
  }
}

watch(activeTab, (registryId) => {
  persistDraftToStorage();
  if (!previews[registryId]) {
    void loadPreview(registryId);
  }
});

watch(
  form,
  () => {
    persistDraftToStorage();
  },
  { deep: true },
);

watch(savedHash, () => {
  persistDraftToStorage();
});

onMounted(() => {
  restoreDraftFromStorage();

  if (!previews[activeTab.value]) {
    void loadPreview(activeTab.value);
  }
});
</script>

<style scoped lang="scss">
.capital-doc-params__intro {
  margin: 0 0 var(--p-4);
  color: var(--p-ink-muted);
}

.capital-doc-params__tabs {
  margin-bottom: var(--p-2);
}

.capital-doc-params__panels {
  background: transparent;
}

.capital-doc-params__toolbar {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}

.capital-doc-params__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--p-4);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
</style>
