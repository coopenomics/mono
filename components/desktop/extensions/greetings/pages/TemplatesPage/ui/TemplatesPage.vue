<template lang="pug">
.q-pa-md.greetings-templates
  PageHint.q-mb-md(storage-key='greetings:templates:hint' variant='info' icon='campaign')
    | {{ $t('greetings.templates.hint') }}

  EmptyState(
    v-if='!firstLoad && !templates.length'
    :title='$t("greetings.templates.emptyTitle")'
    :body='$t("greetings.templates.emptyBody")'
  )
    template(#icon)
      q-icon(name='campaign' size='32px')

  BaseTable(
    v-else
    :columns='columns'
    :rows='templates'
    row-key='id'
    :loading='firstLoad'
    clickable-rows
    min-width='640px'
    @row-click='open'
  )
    template(#cell-title='{ row }')
      .greetings-templates__title {{ row.title }}
      .greetings-templates__meta {{ row.subject }}
    template(#cell-kind='{ row }')
      span {{ kindLabel(row.kind, row.repeat_yearly) }}
    template(#cell-period='{ row }')
      span.t-mono-sm {{ periodLabel(row) }}
    template(#cell-status='{ row }')
      BaseBadge(:variant='templateStatusView(row.status).variant') {{ templateStatusView(row.status).label }}
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseBadge, BaseTable, EmptyState, type BaseTableColumn } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  GREETINGS_LIVE,
  formatDay,
  greetingsApi,
  kindLabel,
  templateStatusView,
  type IGreetingTemplate,
} from '../../../entities/Greeting';
import { Zeus } from '@coopenomics/sdk';
import { CreateTemplateButton } from '../../../features/CreateTemplate';
import { t } from '../../../i18n';

/**
 * Шаблоны поздравлений. Зоны строки: опознание — название и тема письма,
 * период — когда шаблон действует, состояние — черновик или действует.
 * Нажатие по строке открывает редактор шаблона.
 */
const router = useRouter();
const route = useRoute();
const templates = ref<IGreetingTemplate[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

const columns: BaseTableColumn<IGreetingTemplate>[] = [
  { key: 'title', label: t('greetings.templates.columnTitle') },
  { key: 'kind', label: t('greetings.templates.columnKind'), width: '200px', nowrap: true },
  { key: 'period', label: t('greetings.templates.columnPeriod'), width: '220px', nowrap: true },
  { key: 'status', label: t('greetings.templates.columnStatus'), width: '140px', nowrap: true },
];

/** У поздравления — период, у рассылки — дата отправки. */
const periodLabel = (row: IGreetingTemplate) =>
  row.kind === Zeus.GreetingTemplateKind.MAILING
    ? formatDay(row.period_start)
    : t('greetings.templates.period', { start: formatDay(row.period_start), end: formatDay(row.period_end) });

async function load(silent = false) {
  try {
    templates.value = await greetingsApi.loadTemplates();
  } catch (error) {
    console.error(error);
    if (!silent) FailAlert(t('greetings.templates.loadError'));
  } finally {
    loading.value = false;
  }
}

function open(row: IGreetingTemplate) {
  void router.push({ name: 'greetings-template', params: { coopname: route.params.coopname, id: row.id } });
}

const { registerAction, unregisterAction } = useHeaderActions();
const HEADER_ACTION_ID = 'greetings-create-template';

onMounted(() => {
  registerAction({ id: HEADER_ACTION_ID, component: CreateTemplateButton, order: 1 });
  void load();
});
onBeforeUnmount(() => unregisterAction(HEADER_ACTION_ID));

useLiveReload([GREETINGS_LIVE.templates], () => load(true));
</script>

<style scoped lang="scss">
.greetings-templates__title {
  font-weight: 600;
  color: var(--p-ink);
}

.greetings-templates__meta {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
</style>
