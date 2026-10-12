/**
 * Подготовка к одобрению председателя по видам запросов.
 *
 * Запрос одобрения несёт один документ, который председатель подписывает
 * общим слоем. Когда вместе с ним председатель подписывает ещё документы
 * (договор залога и акт у займа), владелец вида запроса регистрирует
 * подготовку при установке своего расширения: она выполняется до подписи
 * основного документа. Ключ — `контракт::действие`, как у подписей запросов.
 */
export interface ApprovalPreSignContext {
  coopname: string;
  approvalHash: string;
}

export type ApprovalPreSign = (ctx: ApprovalPreSignContext) => Promise<void>;

const hooks = new Map<string, ApprovalPreSign>();

/** Зарегистрировать подготовку для вида запроса; повторная регистрация заменяет прежнюю. */
export function registerApprovalPreSign(actionKey: string, hook: ApprovalPreSign): void {
  hooks.set(actionKey, hook);
}

/** Выполнить подготовку, если для вида запроса она зарегистрирована. */
export async function runApprovalPreSign(actionKey: string | undefined, ctx: ApprovalPreSignContext): Promise<void> {
  if (!actionKey) return;
  const hook = hooks.get(actionKey);
  if (hook) await hook(ctx);
}
