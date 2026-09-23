<template lang="pug">
div
  // Рендерим как обычную кнопку, если передан флаг fab
  q-btn.bg-fab-accent-radial(
    v-if="fab"
    color="accent"
    :label="fabMainLabel"
    icon="attach_money"
    @click="openInvest"
    fab
  )

  // Иначе рендерим как экшен для FAB
  q-fab-action.bg-fab-accent-radial(
    v-else
    icon="attach_money"
    :label="fabActionLabel"
    @click="openInvest"
    text-color="white"
  )

  BaseDialog(
    v-model="showDialog",
    :title="$t('capital.projectInvestFabAction.title')",
    size="sm",
    @update:model-value="(v) => !v && (showDialog = false)"
  )
    q-card-section.row.items-center
      span {{ $t('capital.projectInvestFabAction.hint') }}
      div.q-mt-md
        q-btn(flat :label="$t('capital.projectInvestFabAction.acknowledgeAction')" @click="showDialog = false")
        q-btn(
          color="primary"
          :label="$t('capital.projectInvestFabAction.goToComponentsAction')"
          @click="goToComponents"
        )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import type { IProject } from '../../../../../entities/Project/model';
import { formatCapitalFabLabel } from 'app/extensions/capital/shared/lib';
import { t } from '../../../../../i18n';

const props = defineProps<{
  project: IProject | null | undefined;
  fab?: boolean;
}>();
const router = useRouter();
const showDialog = ref(false);

const fabMainLabel = formatCapitalFabLabel(t('capital.projectInvestFabAction.label'), 'invest');
const fabActionLabel = formatCapitalFabLabel(t('capital.projectInvestFabAction.shortLabel'), 'invest');

const openInvest = () => {
  showDialog.value = true;
};

const goToComponents = () => {
  if (props.project?.project_hash) {
    router.push({
      name: 'project-components',
      params: { project_hash: props.project.project_hash }
    });
  }
  showDialog.value = false;
};

defineExpose({
  openDialog: openInvest,
});
</script>
