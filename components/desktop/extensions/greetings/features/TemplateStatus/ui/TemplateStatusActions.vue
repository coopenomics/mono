<template lang="pug">
.row.items-center.q-gutter-sm(v-if='canManage && template')
  BaseButton(
    v-if='isActive'
    variant='secondary'
    size='sm'
    :loading='busy === "status"'
    @click='setStatus(Zeus.GreetingTemplateStatus.DRAFT)'
  ) {{ $t('greetings.editor.deactivate') }}
  BaseButton(
    v-else
    variant='primary'
    size='sm'
    :loading='busy === "status"'
    @click='setStatus(Zeus.GreetingTemplateStatus.ACTIVE)'
  ) {{ $t('greetings.editor.activate') }}
  BaseButton(variant='danger' size='sm' :loading='busy === "delete"' @click='remove') {{ $t('greetings.editor.delete') }}
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useConfirm } from 'src/shared/lib/composables';
import { BaseButton } from 'src/shared/ui/base';
import { greetingsApi, useCanManageGreetings, type IGreetingTemplate } from '../../../entities/Greeting';
import { t } from '../../../i18n';

/**
 * Действия шапки редактора: включить шаблон в рассылку, вернуть в черновики,
 * удалить. Перед включением страница сохраняет текст — правки не теряются.
 */
const props = defineProps<{
  template: IGreetingTemplate | null;
  /** Сохранить несохранённые правки перед сменой состояния; `false` — сохранить не удалось. */
  beforeStatusChange?: () => Promise<boolean>;
  onChanged?: (template: IGreetingTemplate | null) => void;
}>();

const canManage = useCanManageGreetings();
const { confirm } = useConfirm();
const busy = ref<'status' | 'delete' | null>(null);
const isActive = computed(() => props.template?.status === Zeus.GreetingTemplateStatus.ACTIVE);

async function setStatus(status: Zeus.GreetingTemplateStatus) {
  if (!props.template) return;
  busy.value = 'status';
  try {
    if (props.beforeStatusChange && !(await props.beforeStatusChange())) return;
    const updated = await greetingsApi.setTemplateStatus(props.template.id, status);
    SuccessAlert(t(status === Zeus.GreetingTemplateStatus.ACTIVE ? 'greetings.editor.activated' : 'greetings.editor.deactivated'));
    props.onChanged?.(updated);
  } catch (error) {
    FailAlert(error);
  } finally {
    busy.value = null;
  }
}

async function remove() {
  if (!props.template) return;
  const agreed = await confirm({
    title: t('greetings.editor.deleteConfirmTitle'),
    message: t('greetings.editor.deleteConfirmMessage', { title: props.template.title }),
    confirmLabel: t('greetings.editor.delete'),
    danger: true,
  });
  if (!agreed) return;
  busy.value = 'delete';
  try {
    await greetingsApi.deleteTemplate(props.template.id);
    SuccessAlert(t('greetings.editor.deleted'));
    props.onChanged?.(null);
  } catch (error) {
    FailAlert(error);
  } finally {
    busy.value = null;
  }
}
</script>
