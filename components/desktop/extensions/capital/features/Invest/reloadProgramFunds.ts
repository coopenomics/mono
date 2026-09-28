import { useSystemStore } from 'src/entities/System/model';
import { useProjectStore } from 'app/extensions/capital/entities/Project/model';
import { useConfigStore } from 'app/extensions/capital/entities/Config/model';

/**
 * Перечитать проекты и состояние программы после распределения или снятия
 * средств. Мутация отвечает, когда её блок разобран и суммы в базе узла уже
 * новые, поэтому перечитываем сразу. Сторы обновляются молча: страница читает
 * их реактивно, без заглушки загрузки.
 */
export function reloadProgramFunds(): void {
  const coopname = useSystemStore().info.coopname;
  void useProjectStore().loadProjects({
    filter: { coopname, is_component: false },
    options: { page: 1, limit: 100, sortOrder: 'ASC' },
  });
  void useConfigStore().loadState({ coopname });
}
