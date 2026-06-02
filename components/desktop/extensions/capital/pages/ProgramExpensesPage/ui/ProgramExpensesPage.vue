<template lang="pug">
div
  q-banner.q-mb-md(rounded, dense, class='bg-blue-1 text-blue-10')
    template(#avatar)
      q-icon(name='info', color='blue-10')
    | Расходы программы «Благорост» — целевые списания из пула программы, не привязанные к проекту.
    |
    | Председатель создаёт служебную записку, председатель её одобряет, совет авторизует, кассир подтверждает выплату.

  ProgramExpensesTable(
    :rows='rows',
    :loading='loading',
    :pagination='pagination',
    @request='onRequest',
    @row-click='onRowClick'
  )
</template>

<script lang="ts" setup>
import { computed, markRaw, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import {
  useProgramExpenseStore,
  type IProgramExpense,
} from 'app/extensions/capital/entities/ProgramExpense/model';
import { ProgramExpensesTable } from 'app/extensions/capital/widgets/ProgramExpenses';
import CreateProgramExpenseButton from './CreateProgramExpenseButton.vue';

const router = useRouter();
const sessionStore = useSessionStore();
const { info } = useSystemStore();
const store = useProgramExpenseStore();

const loading = ref(false);
const pagination = ref({
  sortBy: 'created_at',
  descending: true,
  page: 1,
  rowsPerPage: 25,
  rowsNumber: 0,
});

const rows = computed<IProgramExpense[]>(() => store.programExpenses?.items ?? []);

const headerButtons = computed(() => {
  if (!sessionStore.isChairman) return [];
  return [
    {
      id: 'create-program-expense',
      component: markRaw(CreateProgramExpenseButton),
      order: 1,
    },
  ];
});

const loadProgramExpenses = async () => {
  loading.value = true;
  try {
    await store.loadProgramExpenses({
      options: {
        page: pagination.value.page,
        limit: pagination.value.rowsPerPage,
        sortBy: pagination.value.sortBy,
        sortOrder: pagination.value.descending ? 'DESC' : 'ASC',
      },
    });
    pagination.value.rowsNumber = store.programExpenses?.totalCount ?? 0;
  } catch (err) {
    FailAlert(err);
  } finally {
    loading.value = false;
  }
};

const onRequest = async (props: { pagination: any }) => {
  const { page, rowsPerPage, sortBy, descending } = props.pagination;
  pagination.value.page = page;
  pagination.value.rowsPerPage = rowsPerPage;
  pagination.value.sortBy = sortBy;
  pagination.value.descending = descending;
  await loadProgramExpenses();
};

const onRowClick = (expense: IProgramExpense) => {
  router.push({
    name: 'program-expense-detail',
    params: { coopname: info.coopname, _id: expense._id },
  });
};

useHeaderActions(headerButtons);
useDataPoller(loadProgramExpenses, POLL_INTERVALS.MEDIUM);

onMounted(loadProgramExpenses);
</script>
