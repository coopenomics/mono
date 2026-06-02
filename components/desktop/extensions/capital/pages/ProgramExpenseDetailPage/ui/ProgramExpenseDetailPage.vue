<template lang="pug">
div(v-if='loading && !expense')
  q-spinner-dots(size='40px', color='primary')

div(v-else-if='expense')
  q-card.q-mb-md(flat, bordered)
    q-card-section
      .row.items-center.no-wrap.q-gutter-md
        .col
          .text-overline.text-grey-7 Расход программы
          .text-h6 № {{ expense.id ?? '—' }} · {{ formatAmount(expense.amount) }}
          .text-caption.text-grey-7.q-mt-xs {{ expense.description || '—' }}
        .col-auto
          q-chip(
            :color='statusColor(expense.status)',
            text-color='white',
            dense,
            square,
            size='md'
          ) {{ statusLabel(expense.status) }}

    q-separator

    q-card-section
      .row.q-col-gutter-md
        .col-12.col-md-4
          .text-caption.text-grey-7 Инициатор
          .text-body2 {{ expense.username || '—' }}
        .col-12.col-md-4
          .text-caption.text-grey-7 Дата
          .text-body2 {{ formatDate(expense.spended_at) }}
        .col-12.col-md-4
          .text-caption.text-grey-7 Фонд
          .text-body2 {{ expense.fund_id ?? '—' }}
        .col-12
          .text-caption.text-grey-7 Хэш расхода
          code.text-caption {{ expense.expense_hash }}

  q-card.q-mb-md(flat, bordered)
    q-card-section
      .text-subtitle1 Документы
    q-separator
    q-list
      DocumentRow(
        title='Служебная записка (1010)',
        :document='expense.expense_statement'
      )
      q-separator(inset)
      DocumentRow(
        title='Одобренная записка',
        :document='expense.approved_statement'
      )
      q-separator(inset)
      DocumentRow(
        title='Протокол решения совета (1011)',
        :document='expense.authorization'
      )

  q-card(flat, bordered)
    q-card-section
      .text-subtitle1 Жизненный цикл
      WorkflowSteps(:status='expense.status')

    q-separator

    q-card-actions(align='right', class='q-pa-md')
      template(v-if='expense.status === `created`')
        q-btn(
          v-if='canChair',
          flat,
          color='negative',
          icon='close',
          label='Отклонить',
          no-caps,
          @click='openDeclineDialog'
        )
        q-btn(
          v-if='canChair',
          color='primary',
          icon='check',
          label='Одобрить',
          unelevated,
          no-caps,
          class='q-ml-sm',
          @click='openApproveDialog'
        )

      template(v-else-if='expense.status === `approved`')
        q-btn(
          v-if='canCouncil',
          flat,
          color='negative',
          icon='close',
          label='Отклонить',
          no-caps,
          @click='openDeclineDialog'
        )
        q-btn(
          v-if='canCouncil',
          color='primary',
          icon='gavel',
          label='Авторизовать',
          unelevated,
          no-caps,
          class='q-ml-sm',
          @click='openAuthorizeDialog'
        )

      template(v-else-if='expense.status === `authorized`')
        q-btn(
          v-if='canChair',
          flat,
          color='negative',
          icon='close',
          label='Отклонить',
          no-caps,
          @click='openDeclineDialog'
        )
        q-btn(
          v-if='canChair',
          color='positive',
          icon='payments',
          label='Подтвердить выплату',
          unelevated,
          no-caps,
          class='q-ml-sm',
          @click='openPayDialog'
        )

      template(v-else)
        .text-caption.text-grey-7 Дальнейшие действия не требуются — статус финальный.

  q-card.q-mt-md(v-if='canChair', flat, bordered)
    q-card-section
      .text-subtitle1 Пул программных расходов
      .text-caption.text-grey-7.q-mt-xs Пополнение пула — отдельная операция председателя; средства списываются из BLAGOROST_POOL.
    q-card-actions(align='right', class='q-pa-md')
      q-btn(
        color='primary',
        icon='add',
        label='Пополнить пул',
        outline,
        no-caps,
        @click='openTopupDialog'
      )

WorkflowActionDialog(
  v-model='dialog.show',
  :action='dialog.action',
  :expense='expense',
  @done='reload'
)

div(v-else)
  q-banner(rounded, class='bg-red-1 text-red-10')
    template(#avatar)
      q-icon(name='error', color='red-10')
    | Расход программы не найден.
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert } from 'src/shared/api';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { useProgramExpenseStore } from 'app/extensions/capital/entities/ProgramExpense/model';
import DocumentRow from './DocumentRow.vue';
import WorkflowSteps from './WorkflowSteps.vue';
import WorkflowActionDialog from './WorkflowActionDialog.vue';

type WorkflowAction = 'approve' | 'authorize' | 'pay' | 'decline' | 'topup';

const route = useRoute();
const sessionStore = useSessionStore();
const store = useProgramExpenseStore();

const loading = ref(false);
const expense = computed(() => store.programExpense);

const canChair = computed(() => sessionStore.isChairman);
const canCouncil = computed(() => sessionStore.isChairman || sessionStore.isMember);

const dialog = reactive<{ show: boolean; action: WorkflowAction }>({
  show: false,
  action: 'approve',
});

const openApproveDialog = () => { dialog.action = 'approve'; dialog.show = true; };
const openAuthorizeDialog = () => { dialog.action = 'authorize'; dialog.show = true; };
const openPayDialog = () => { dialog.action = 'pay'; dialog.show = true; };
const openDeclineDialog = () => { dialog.action = 'decline'; dialog.show = true; };
const openTopupDialog = () => { dialog.action = 'topup'; dialog.show = true; };

const load = async () => {
  const _id = route.params._id as string;
  if (!_id) return;
  loading.value = true;
  try {
    await store.loadProgramExpense({ _id });
  } catch (err) {
    FailAlert(err);
  } finally {
    loading.value = false;
  }
};

const reload = async () => {
  await load();
};

function statusColor(status: string): string {
  const map: Record<string, string> = {
    created: 'orange',
    approved: 'blue',
    authorized: 'teal',
    paid: 'positive',
    declined: 'negative',
    undefined: 'grey-6',
  };
  return map[status] ?? 'grey-6';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    created: 'Создан',
    approved: 'Одобрен',
    authorized: 'Авторизован',
    paid: 'Выплачен',
    declined: 'Отклонён',
    undefined: 'Не определён',
  };
  return map[status] ?? status;
}

function formatAmount(amount?: string): string {
  return amount || '—';
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('ru-RU');
}

useDataPoller(load, POLL_INTERVALS.MEDIUM);
onMounted(load);
</script>
