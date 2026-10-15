import { computed, type ComputedRef } from 'vue';
import { useDesktopStore } from 'src/entities/Desktop';

/**
 * Права записи на столе бухгалтера. Стол читает член совета; ведут его
 * председатель и бухгалтер — кнопки записи показываются по праву сервера.
 */
export function useReportsRights(): { canDraft: ComputedRef<boolean>; canPayTax: ComputedRef<boolean> } {
  const desktop = useDesktopStore();
  return {
    canDraft: computed(() => desktop.hasGrant('reports', 'Report:draft')),
    canPayTax: computed(() => desktop.hasGrant('reports', 'WithheldTax:pay')),
  };
}
