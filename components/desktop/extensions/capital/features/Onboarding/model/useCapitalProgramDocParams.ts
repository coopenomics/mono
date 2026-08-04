import { computed, reactive, ref } from 'vue';
import { useQuasar } from 'quasar';
import type { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { api as documentApi } from 'src/shared/lib/document/api';
import { api } from '../api';
import {
  ALL_DOC_FIELDS,
  BLAGOROST_DOC_FIELDS,
  FIELD_LABELS,
  GENERATOR_DOC_FIELDS,
  PREVIEW_PLACEHOLDER,
  type EditableFieldKey,
} from './capitalProgramDocFields';
import {
  DOC_WIZARD_STEP_BLAGOROST,
  DOC_WIZARD_STEP_GENERATOR,
} from './capitalOnboardingWizard';
import {
  getCapitalProgramDocParamsDraftKey,
  readCapitalProgramDocParamsDraft,
  writeCapitalProgramDocParamsDraft,
} from './useCapitalProgramDocParamsDraft';

type PreviewState = {
  html: string;
  docDataHash: string;
};

const DOC_FIELDS_BY_REGISTRY: Record<number, EditableFieldKey[]> = {
  994: GENERATOR_DOC_FIELDS,
  998: BLAGOROST_DOC_FIELDS,
};

function createEmptyForm(): Record<EditableFieldKey, string> {
  return Object.fromEntries(ALL_DOC_FIELDS.map((key) => [key, ''])) as Record<EditableFieldKey, string>;
}

export function useCapitalProgramDocParams(options?: { onSaved?: (hash: string) => void | Promise<void> }) {
  const $q = useQuasar();
  const systemStore = useSystemStore();
  const sessionStore = useSessionStore();

  const saving = ref(false);
  const savedHash = ref('');
  const loadingRegistryId = ref<number | null>(null);
  const wizardStepKey = ref<string>(DOC_WIZARD_STEP_GENERATOR);

  const previews = reactive<Partial<Record<number, PreviewState>>>({});
  const form = reactive<Record<EditableFieldKey, string>>(createEmptyForm());

  const draftStorageKey = computed(() =>
    getCapitalProgramDocParamsDraftKey(systemStore.info?.coopname ?? '', sessionStore.username ?? ''),
  );

  const editableFields = computed(() =>
    ALL_DOC_FIELDS.map((key) => ({
      key,
      label: FIELD_LABELS[key],
    })),
  );

  function persistDraftToStorage() {
    writeCapitalProgramDocParamsDraft(draftStorageKey.value, {
      form: { ...form },
      wizardStepKey: wizardStepKey.value,
      savedHash: savedHash.value,
      previews: { ...previews },
    });
  }

  function restoreDraftFromStorage() {
    const draft = readCapitalProgramDocParamsDraft(draftStorageKey.value);
    if (!draft) return;

    Object.assign(form, draft.form);
    savedHash.value = draft.savedHash;
    Object.assign(previews, draft.previews);
    wizardStepKey.value = draft.wizardStepKey ?? DOC_WIZARD_STEP_GENERATOR;
  }

  function getPreviewPayload(): Cooperative.Registry.CapitalProgramPrivateData {
    return Object.fromEntries(
      ALL_DOC_FIELDS.map((key) => [key, String(form[key] ?? '').trim() || PREVIEW_PLACEHOLDER]),
    ) as Record<EditableFieldKey, string>;
  }

  function getMissingCount(registryId: number): number {
    const fields = DOC_FIELDS_BY_REGISTRY[registryId] ?? [];
    return fields.filter((key) => !String(form[key] ?? '').trim()).length;
  }

  function validateSection(registryId: number): string | null {
    const fields = DOC_FIELDS_BY_REGISTRY[registryId] ?? [];
    const missing = fields
      .filter((key) => !String(form[key] ?? '').trim())
      .map((key) => FIELD_LABELS[key]);

    if (missing.length) {
      return `Заполните все поля документа: ${missing.join(', ')}`;
    }

    return null;
  }

  function validateAll(): string | null {
    const missing = editableFields.value
      .filter(({ key }) => !String(form[key] ?? '').trim())
      .map(({ label }) => label);

    if (missing.length) {
      return `Заполните все параметры в документах: ${missing.join(', ')}`;
    }

    return null;
  }

  function getDocDataHashFromResult(result: Awaited<ReturnType<typeof documentApi.generateDocument>>): string {
    const meta = result.meta as { doc_data_hash?: string } | undefined;
    return meta?.doc_data_hash ?? '';
  }

  async function loadPreview(registryId: number) {
    loadingRegistryId.value = registryId;

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
      $q.notify({
        type: 'negative',
        message: error instanceof Error ? error.message : 'Не удалось сформировать предпросмотр',
      });
      throw error;
    } finally {
      loadingRegistryId.value = null;
    }
  }

  async function saveParams() {
    const validationError = validateAll();
    if (validationError) {
      $q.notify({ type: 'warning', message: validationError });
      return false;
    }

    saving.value = true;

    try {
      await loadPreview(994);
      await loadPreview(998);

      const hash = previews[994]?.docDataHash ?? previews[998]?.docDataHash;
      if (!hash) {
        throw new Error('Не удалось получить хеш параметров документов');
      }

      await api.saveProgramDocDataHash({ doc_data_hash: hash });

      savedHash.value = hash;
      persistDraftToStorage();
      await options?.onSaved?.(hash);

      $q.notify({
        type: 'positive',
        message: 'Параметры документов ЦПП сохранены',
      });

      return true;
    } catch (error) {
      $q.notify({
        type: 'negative',
        message: error instanceof Error ? error.message : 'Не удалось сохранить параметры',
      });
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function ensurePreview(registryId: number) {
    if (previews[registryId]?.html) return;
    await loadPreview(registryId);
  }

  function setWizardStepKey(key: string) {
    wizardStepKey.value = key;
    persistDraftToStorage();
  }

  return {
    form,
    previews,
    savedHash,
    saving,
    loadingRegistryId,
    wizardStepKey,
    restoreDraftFromStorage,
    persistDraftToStorage,
    getMissingCount,
    validateSection,
    loadPreview,
    ensurePreview,
    saveParams,
    setWizardStepKey,
  };
}

export function getRegistryIdForDocWizardStep(stepKey: string): number | null {
  if (stepKey === DOC_WIZARD_STEP_GENERATOR) return 994;
  if (stepKey === DOC_WIZARD_STEP_BLAGOROST) return 998;
  return null;
}
