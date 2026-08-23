<template lang="pug">
div.q-px-md
  //- Сохранение только по кнопке: правка приглашения — транзакция editproj в цепь
  .row.items-center.invite-save-bar(v-if="project")
    .col
      .text-caption(:class="hasChanges ? 'text-warning' : 'text-grey-7'") {{ statusText }}
    .col-auto
      BaseButton(
        v-if="canEdit"
        variant="primary"
        size="sm"
        :disabled="!hasChanges || isSaving"
        :loading="isSaving"
        @click="save"
      ) Сохранить
  Editor(
    :min-height="300",
    v-if="project"
    v-model='invite',
    :placeholder='placeholder',
    :readonly="!canEdit"
    @ready="markOriginal"
  ).q-mb-xl
</template>

<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { IProjectPermissions } from 'app/extensions/capital/entities/Project/model';
import { useProjectLoader } from 'app/extensions/capital/entities/Project/model';
import { Editor } from 'src/shared/ui';
import { BaseButton } from 'src/shared/ui/base';
import { buildEditProjectInput, useEditProject } from 'app/extensions/capital/features/Project/EditProject';
import { useUnsavedGuard } from 'app/extensions/capital/features/ContentRevisions';
import { toMarkdown } from 'src/shared/lib/utils';
import { SuccessAlert, FailAlert } from 'src/shared/api/alerts';

defineProps<{
  placeholder: string;
}>();

const { save: saveProject, isSaving } = useEditProject();
const { project, loadProject } = useProjectLoader();

const originalInvite = ref('');
const saved = ref(false);

const invite = computed({
  get: () => project.value?.invite || '',
  set: (value: string) => {
    if (project.value) project.value.invite = value;
  },
});

const permissions = computed((): IProjectPermissions | null => project.value?.permissions || null);
const canEdit = computed(() => !!permissions.value?.can_edit_project);
const hasChanges = computed(() => !!project.value && invite.value !== originalInvite.value);
const statusText = computed(() => {
  if (isSaving.value) return 'Сохранение…';
  if (hasChanges.value) return 'Есть несохранённые изменения';
  return saved.value ? 'Сохранено' : '';
});

const markOriginal = async () => {
  await nextTick();
  originalInvite.value = invite.value;
};

const save = async () => {
  if (!project.value || !canEdit.value || !hasChanges.value) return;
  const result = await saveProject(buildEditProjectInput(project.value, { invite: invite.value }));
  if (!result.ok) {
    FailAlert('Проект изменён параллельно: обновите страницу и повторите сохранение приглашения');
    return;
  }
  await loadProject();
  saved.value = true;
  SuccessAlert('Приглашение сохранено');
};

const onKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    void save();
  }
};

useUnsavedGuard(hasChanges);

onMounted(async () => {
  window.addEventListener('keydown', onKeydown);
  await loadProject();
});
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

watch(project, (newProject) => {
  if (newProject?.invite) {
    newProject.invite = toMarkdown(newProject.invite);
  }
  originalInvite.value = newProject?.invite || '';
});
</script>

<style lang="scss" scoped>
.invite-save-bar {
  min-height: var(--p-8);
  padding-bottom: var(--p-2);
}
</style>
