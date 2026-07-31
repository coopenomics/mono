<template lang="pug">
.column.items-stretch
  q-btn(
    v-if='!hideTrigger',
    flat,
    dense,
    size='sm',
    color='primary',
    class='full-width',
    icon='drive_file_move',
    :label='isAssignMode ? "Назначить компонент" : "Переместить"',
    :disable='isActionDisabled',
    @click='openDialog'
  )

  BaseDialog(
    v-model='dialogOpen',
    :title='isAssignMode ? "Назначить компонент задаче" : "Перенос задачи в другой компонент"',
    size='md',
    @update:model-value='(v) => !v && resetDialog()'
  )
    Form.q-pa-sm(
      :handler-submit='confirmMove',
      :is-submitting='isSubmitting',
      button-cancel-txt='Отменить',
      :button-submit-txt='isAssignMode ? "Назначить" : "Перенести"',
      @cancel='close'
    )
      q-select.full-width(
        ref='selectRef',
        v-model='selectedHash',
        :options='filteredOptions',
        option-value='project_hash',
        option-label='label',
        emit-value,
        map-options,
        use-input,
        fill-input,
        hide-selected,
        input-debounce='0',
        outlined,
        dense,
        autofocus,
        :label='isAssignMode ? "Компонент" : "Компонент для переноса"',
        :loading='optionsLoading',
        @filter='filterTargets',
        @keydown.enter='onEnterKey'
      )
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue';
import type { QSelect } from 'quasar';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { EMPTY_HASH } from 'src/shared/lib/consts';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import type { IIssue, IIssuePermissions } from 'app/extensions/capital/entities/Issue/model';
import { useMoveIssueToComponent } from '../model';

interface TargetOption {
  project_hash: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    issue: IIssue;
    /** Хеш текущего компонента; пусто — режим назначения свободной задачи */
    projectHash?: string | null;
    permissions?: IIssuePermissions | null;
    /** parent_hash родительского проекта (у компонента задачи); без него перенос между компонентами недоступен */
    parentProjectHash?: string | null;
    /** Скрыть кнопку-триггер (диалог открывается через openDialog) */
    hideTrigger?: boolean;
  }>(),
  {
    projectHash: null,
    parentProjectHash: null,
    hideTrigger: false,
  },
);

const emit = defineEmits<{
  moved: [{ updatedIssue: IIssue; fromProjectHash: string; toProjectHash: string }];
}>();

const { info } = useSystemStore();
const session = useSessionStore();
const { moveIssue } = useMoveIssueToComponent();

const dialogOpen = ref(false);
const isSubmitting = ref(false);
const optionsLoading = ref(false);
const targetOptions = ref<TargetOption[]>([]);
const filteredOptions = ref<TargetOption[]>([]);
const selectedHash = ref<string | null>(null);
const selectRef = ref<QSelect | null>(null);

const hasConsumedLinked = computed(() =>
  (props.issue.linked_git_commits ?? []).some((c) => c.consumed),
);

const isAssignMode = computed(() => !props.projectHash?.trim());

const hasParentProject = computed(() => {
  const ph = props.parentProjectHash?.trim();
  return Boolean(ph && ph !== EMPTY_HASH);
});

const isActionDisabled = computed(() => {
  if (hasConsumedLinked.value) return true;
  if (isAssignMode.value) {
    return !props.permissions?.can_move_issue && !props.permissions?.can_edit_issue;
  }
  return (
    !hasParentProject.value ||
    !props.permissions?.can_move_issue
  );
});

function formatTargetLabel(p: IProject, assignMode: boolean): string {
  const idPart = p.id != null && p.id !== undefined ? `[#${p.id}] ` : '';
  const title = (p.title ?? '').trim() || 'Компонент';
  if (!assignMode) {
    return `${idPart}${title}`.trim();
  }
  const parent = (p.parent_title ?? '').trim();
  return parent ? `${parent} — ${title}` : `${idPart}${title}`.trim();
}

const loadTargets = async () => {
  optionsLoading.value = true;
  try {
    if (isAssignMode.value) {
      const username = session.username || '';
      if (!username) {
        targetOptions.value = [];
        filteredOptions.value = [];
        return;
      }
      const res = await ProjectApi.loadProjects({
        filter: {
          coopname: info.coopname,
          master: username,
          origin: 'any',
          is_component: true,
          statuses: [Zeus.ProjectStatus.PENDING, Zeus.ProjectStatus.ACTIVE],
        },
        options: { page: 1, limit: 200, sortOrder: 'ASC' },
      });
      const rows = (res.items ?? []).filter(
        (p) => p.permissions?.can_manage_issues === true,
      );
      targetOptions.value = rows.map((p) => ({
        project_hash: p.project_hash,
        label: formatTargetLabel(p, true),
      }));
      filteredOptions.value = [...targetOptions.value];
      return;
    }

    const parent = props.parentProjectHash?.trim();
    if (!parent || parent === EMPTY_HASH) {
      targetOptions.value = [];
      filteredOptions.value = [];
      return;
    }
    const res = await ProjectApi.loadProjects({
      filter: {
        parent_hash: parent,
        is_component: true,
        statuses: [Zeus.ProjectStatus.PENDING, Zeus.ProjectStatus.ACTIVE],
      },
      options: { page: 1, limit: 200, sortOrder: 'ASC' },
    });
    const from = (props.projectHash || '').toLowerCase();
    const rows = (res.items ?? []).filter(
      (p) => p.project_hash?.toLowerCase() !== from,
    );
    targetOptions.value = rows.map((p) => ({
      project_hash: p.project_hash,
      label: formatTargetLabel(p, false),
    }));
    filteredOptions.value = [...targetOptions.value];
  } catch (e: unknown) {
    console.error(e);
    FailAlert(e, 'Не удалось загрузить список компонентов');
    targetOptions.value = [];
    filteredOptions.value = [];
  } finally {
    optionsLoading.value = false;
  }
};

function filterTargets(val: string, update: (fn: () => void) => void) {
  update(() => {
    const needle = val.toLowerCase().trim();
    filteredOptions.value = !needle
      ? [...targetOptions.value]
      : targetOptions.value.filter((o) => o.label.toLowerCase().includes(needle));
  });
}

async function focusSelect() {
  await nextTick();
  const sel = selectRef.value;
  if (!sel) return;
  sel.focus();
  sel.showPopup();
}

const openDialog = () => {
  if (!props.hideTrigger && isActionDisabled.value) return;
  dialogOpen.value = true;
};

const resetDialog = () => {
  selectedHash.value = null;
  filteredOptions.value = [];
};

const close = () => {
  dialogOpen.value = false;
};

watch(dialogOpen, (open) => {
  if (open) {
    void (async () => {
      await loadTargets();
      await focusSelect();
    })();
  } else {
    resetDialog();
  }
});

/** Выбор в списке (клик / Enter по опции) сразу назначает. */
watch(selectedHash, (value) => {
  if (!dialogOpen.value || !value?.trim() || isSubmitting.value) return;
  void confirmMove();
});

/** Enter при одном совпадении в фильтре — сразу выбрать его (дальше сработает watch). */
function onEnterKey(e: Event) {
  if (selectedHash.value?.trim() || isSubmitting.value) return;
  if (filteredOptions.value.length !== 1) return;
  e.preventDefault();
  e.stopPropagation();
  selectedHash.value = filteredOptions.value[0].project_hash;
}

const confirmMove = async () => {
  if (isSubmitting.value) return;

  if (!selectedHash.value?.trim() && filteredOptions.value.length === 1) {
    selectedHash.value = filteredOptions.value[0].project_hash;
    return;
  }

  const to = selectedHash.value?.trim();
  if (!to) {
    FailAlert(null, 'Выберите компонент');
    return;
  }
  isSubmitting.value = true;
  try {
    const from = props.projectHash?.trim() || '';
    const updated = await moveIssue(
      { issue_hash: props.issue.issue_hash, target_project_hash: to },
      from || null,
    );
    SuccessAlert(isAssignMode.value ? 'Компонент назначен' : 'Задача перенесена');
    emit('moved', {
      updatedIssue: updated,
      fromProjectHash: from,
      toProjectHash: to.toLowerCase(),
    });
    close();
  } catch (e: unknown) {
    FailAlert(e, isAssignMode.value ? 'Не удалось назначить компонент' : 'Не удалось перенести задачу');
  } finally {
    isSubmitting.value = false;
  }
};

defineExpose({ openDialog });
</script>
