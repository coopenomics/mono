import { ALL_DOC_FIELDS, type EditableFieldKey } from './capitalProgramDocFields';

const STORAGE_PREFIX = 'capital-cpp-doc-params-draft';

export type CapitalProgramDocParamsPreviewState = {
  html: string;
  docDataHash: string;
};

export type CapitalProgramDocParamsDraft = {
  form: Record<EditableFieldKey, string>;
  /** @deprecated используйте wizardStepKey */
  activeTab?: number;
  wizardStepKey?: string;
  savedHash: string;
  previews: Partial<Record<number, CapitalProgramDocParamsPreviewState>>;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getCapitalProgramDocParamsDraftKey(coopname: string, username: string): string {
  return `${STORAGE_PREFIX}:${coopname || 'unknown'}:${username || 'unknown'}`;
}

function isEditableFieldKey(key: string): key is EditableFieldKey {
  return (ALL_DOC_FIELDS as readonly string[]).includes(key);
}

function createEmptyForm(): Record<EditableFieldKey, string> {
  return Object.fromEntries(ALL_DOC_FIELDS.map((key) => [key, ''])) as Record<EditableFieldKey, string>;
}

function normalizeForm(raw: unknown): Record<EditableFieldKey, string> | null {
  if (!raw || typeof raw !== 'object') return null;

  const form = createEmptyForm();
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isEditableFieldKey(key) && typeof value === 'string') {
      form[key] = value;
    }
  }

  return form;
}

function normalizePreviews(raw: unknown): Partial<Record<number, CapitalProgramDocParamsPreviewState>> {
  const previews: Partial<Record<number, CapitalProgramDocParamsPreviewState>> = {};
  if (!raw || typeof raw !== 'object') return previews;

  for (const [id, preview] of Object.entries(raw as Record<string, unknown>)) {
    const registryId = Number(id);
    if (!Number.isFinite(registryId) || !preview || typeof preview !== 'object') continue;

    const html = (preview as CapitalProgramDocParamsPreviewState).html;
    const docDataHash = (preview as CapitalProgramDocParamsPreviewState).docDataHash;
    if (typeof html === 'string' && typeof docDataHash === 'string') {
      previews[registryId] = { html, docDataHash };
    }
  }

  return previews;
}

export function readCapitalProgramDocParamsDraft(storageKey: string): CapitalProgramDocParamsDraft | null {
  if (!isBrowser()) return null;

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CapitalProgramDocParamsDraft>;
    const form = normalizeForm(parsed.form);
    if (!form) return null;

    const legacyTab = typeof parsed.activeTab === 'number' ? parsed.activeTab : 994;
    const wizardStepKey =
      typeof parsed.wizardStepKey === 'string'
        ? parsed.wizardStepKey
        : legacyTab === 998
          ? 'doc_blagorost'
          : 'doc_generator';

    return {
      form,
      wizardStepKey,
      savedHash: typeof parsed.savedHash === 'string' ? parsed.savedHash : '',
      previews: normalizePreviews(parsed.previews),
    };
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function writeCapitalProgramDocParamsDraft(storageKey: string, draft: CapitalProgramDocParamsDraft): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch (error) {
    console.warn('Failed to persist capital CPP doc params draft:', error);
  }
}
