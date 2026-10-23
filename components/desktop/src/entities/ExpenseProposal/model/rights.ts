import { computed, type ComputedRef } from 'vue';
import { useRoute, type RouteMeta } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useDesktopStore } from 'src/entities/Desktop/model';

/** Право закрыть расход по отчётам: председатель и кассир (таблица прав расходов). */
export const EXPENSE_CLOSE_RIGHT = 'ExpenseProposal:submit-report';

/**
 * Можно ли закрыть расход: отчёт подан по всем строкам и у пайщика есть
 * право закрытия. Совет записку читает, кнопки закрытия у него нет.
 */
export function useMayCloseExpense(): (status?: Zeus.ExpenseProposalStatus | null) => boolean {
  const route = useRoute();
  const desktop = useDesktopStore();
  const allowed: ComputedRef<boolean> = computed(() =>
    desktop.hasRouteAccess(route.matched.map((record) => record.name), { requires: EXPENSE_CLOSE_RIGHT } as RouteMeta),
  );
  return (status) => status === Zeus.ExpenseProposalStatus.REPORT_SUBMITTED && allowed.value;
}
