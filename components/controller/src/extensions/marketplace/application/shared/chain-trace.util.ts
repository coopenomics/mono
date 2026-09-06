/**
 * Поиск данных инлайн-действия в трассе выполненной транзакции.
 *
 * Контракт-инициатор (marketplace) ставит повестку совета инлайн, а совет тем
 * же вызовом эмитит `newsubmitted` с номером решения — он есть в трассе ответа
 * ноды на нашу же транзакцию (`processed.action_traces[].inline_traces`), и его
 * можно взять сразу, не дожидаясь парсера (L20).
 */
interface ActionTrace {
  act?: { account?: string; name?: string; data?: unknown };
  inline_traces?: ActionTrace[];
}

function searchTraces(traces: ActionTrace[], actionName: string, account?: string): unknown {
  for (const trace of traces) {
    if (trace.act?.name === actionName && (!account || trace.act.account === account)) return trace.act.data;
    if (trace.inline_traces?.length) {
      const found = searchTraces(trace.inline_traces, actionName, account);
      if (found !== undefined && found !== null) return found;
    }
  }
  return null;
}

/** Данные первого инлайн-действия `actionName` (опционально — только контракта `account`) в ответе транзакции. */
export function findInlineActionData<T = Record<string, unknown>>(tx: unknown, actionName: string, account?: string): T | null {
  const candidates = [tx, (tx as { response?: unknown })?.response, (tx as { resolved?: unknown })?.resolved];
  for (const candidate of candidates) {
    const traces = (candidate as { processed?: { action_traces?: ActionTrace[] } } | undefined)?.processed?.action_traces;
    if (Array.isArray(traces)) {
      const found = searchTraces(traces, actionName, account);
      if (found) return found as T;
    }
  }
  return null;
}
