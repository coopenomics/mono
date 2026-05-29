<template lang="pug">
.column.items-stretch
  q-btn(
    flat
    dense
    size="sm"
    color="primary"
    class="full-width"
    icon="drive_file_move"
    label="Переместить"
    :disable="!!moveDisabledReason"
    @click="openDialog"
  )
  .text-caption.q-mt-xs.text-grey-7(v-if="moveDisabledReason") {{ moveDisabledReason }}

  BaseDialog(
    v-model="dialogOpen",
    title="Перенос задачи в другой компонент",
    size="md",
    @update:model-value="(v) => !v && resetDialog()"
  )
    Form.q-pa-sm(
      :handler-submit="confirmMove"
      :is-submitting="isSubmitting"
      button-cancel-txt="Отменить"
      button-submit-txt="Перенести"
      @cancel="close"
    )
      div(style="max-width: 420px")
        p.text-body2.q-mb-sm
          | Перенос допустим только в рамках одного проекта. Для перемещения доступны другие компоненты проекта в статусах «ожидание» и «активен». Время по задаче переносится вместе с ней.
        q-select(
          v-model="selectedHash"
          :options="targetOptions"
          option-value="project_hash"
          option-label="label"
          emit-value
          map-options
          outlined
          dense
          label="Компонент для переноса"
          :loading="optionsLoading"
        )
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { EMPTY_HASH } from 'src/shared/lib/consts';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import { Zeus } from '@coopenomics/sdk';
import { api as ProjectApi } from 'app/extensions/capital/entities/Project/api';
import type { IProject } from 'app/extensions/capital/entities/Project/model';
import type { IIssue, IIssuePermissions } from 'app/extensions/capital/entities/Issue/model';
import { useMoveIssueToComponent } from '../model';

interface TargetOption {
  project_hash: string;
  label: string;
}

const props = defineProps<{
  issue: IIssue;
  projectHash: string;
  permissions?: IIssuePermissions | null;
  /** parent_hash родительского проекта (у компонента задачи); без него перенос между компонентами недоступен */
  parentProjectHash?: string | null;
}>();

const emit = defineEmits<{
  moved: [{ updatedIssue: IIssue; fromProjectHash: string; toProjectHash: string }];
}>();

const { moveIssue } = useMoveIssueToComponent();

const dialogOpen = ref(false);
const isSubmitting = ref(false);
const optionsLoading = ref(false);
const targetOptions = ref<TargetOption[]>([]);
const selectedHash = ref<string | null>(null);

const hasConsumedLinked = computed(() =>
  (props.issue.linked_git_commits ?? []).some((c) => c.consumed),
);

const hasParentProject = computed(() => {
  const ph = props.parentProjectHash?.trim();
  return Boolean(ph && ph !== EMPTY_HASH);
});

/** null = кнопка активна; иначе текст под кнопкой (почему перенос недоступен) */
const moveDisabledReason = computed((): string | null => {
  if (!hasParentProject.value) {
    return 'Перенос только для задач в компоненте проекта (нужен родительский проект у компонента).';
  }
  if (hasConsumedLinked.value) {
    return 'Перенос недоступен: привязанные Git-коммиты уже учтены в коммите CAPITAL.';
  }
  if (!props.permissions?.can_move_issue) {
    return 'Перенос недоступен: компонент не в статусах «ожидание» или «активен», либо нет прав мастера на задачи.';
  }
  return null;
});

function formatTargetLabel(p: IProject): string {
  const idPart = p.id != null && p.id !== undefined ? `[#${p.id}] ` : '';
  const t = (p.title ?? '').trim();
  return `${idPart}${t || 'Компонент'}`.trim();
}

const loadTargets = async () => {
  const parent = props.parentProjectHash?.trim();
  if (!parent || parent === EMPTY_HASH) {
    targetOptions.value = [];
    return;
  }
  optionsLoading.value = true;
  try {
    const res = await ProjectApi.loadProjects({
      filter: {
        parent_hash: parent,
        is_component: true,
        statuses: [Zeus.ProjectStatus.PENDING, Zeus.ProjectStatus.ACTIVE],
      },
      options: { page: 1, limit: 200, sortOrder: 'ASC' },
    });
    const from = props.projectHash.toLowerCase();
    const rows = (res.items ?? []).filter(
      (p) => p.project_hash?.toLowerCase() !== from,
    );
    targetOptions.value = rows.map((p) => ({
      project_hash: p.project_hash,
      label: formatTargetLabel(p),
    }));
  } catch (e: unknown) {
    console.error(e);
    FailAlert(e, 'Не удалось загрузить список компонентов');
    targetOptions.value = [];
  } finally {
    optionsLoading.value = false;
  }
};

const openDialog = () => {
  if (moveDisabledReason.value) return;
  dialogOpen.value = true;
};

const resetDialog = () => {
  selectedHash.value = null;
};

const close = () => {
  dialogOpen.value = false;
};

watch(dialogOpen, (open) => {
  if (open) {
    void loadTargets();
  } else {
    resetDialog();
  }
});

const confirmMove = async () => {
  const to = selectedHash.value?.trim();
  if (!to) {
    FailAlert(null, 'Выберите компонент для переноса');
    return;
  }
  isSubmitting.value = true;
  try {
    const updated = await moveIssue(
      { issue_hash: props.issue.issue_hash, target_project_hash: to },
      props.projectHash,
    );
    SuccessAlert('Задача перенесена');
    emit('moved', {
      updatedIssue: updated,
      fromProjectHash: props.projectHash,
      toProjectHash: to.toLowerCase(),
    });
    close();
  } catch (e: unknown) {
    FailAlert(e, 'Не удалось перенести задачу');
  } finally {
    isSubmitting.value = false;
  }
};
</script>
