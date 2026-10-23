import { CORE_ROLES_APPS } from './core-rights';

/** Поиск председателя: та же выборка учётных записей по роли узла, что у портов счетов. */
interface ChairmanDirectory {
  getAccounts(
    filter: { role: string },
    options: { page: number; limit: number; sortOrder: 'ASC' | 'DESC' }
  ): Promise<{ items: { username: string }[] }>;
}

/** Держатели назначенной роли. */
interface RoleHolders {
  holdersOf(extensionName: string, role: string): Promise<string[]>;
}

/** Ключ роли «Кассир». */
export const CASHIER_ROLE = 'cashier';

/**
 * Кто подтверждает платежи в реестре платежей: председатель и пайщики с ролью
 * «Кассир». Им уходят уведомления «подтвердите платёж», ссылка ведёт на стол
 * кассира. Повтор (председатель с ролью кассира) убирается.
 */
export async function cashDeskConfirmers(accounts: ChairmanDirectory, roles: RoleHolders): Promise<string[]> {
  const [chairmen, cashiers] = await Promise.all([
    accounts.getAccounts({ role: 'chairman' }, { page: 1, limit: 1, sortOrder: 'ASC' }),
    roles.holdersOf(CORE_ROLES_APPS.cashier, CASHIER_ROLE),
  ]);
  return [...new Set([...(chairmen.items ?? []).map((account) => account.username), ...cashiers])];
}

/** Реестр платежей стола кассира: сюда ведут уведомления о платеже на подтверждение. */
export function cashierPaymentsUrl(frontendUrl: string, coopname: string, username?: string): string {
  return `${frontendUrl}/${coopname}/cashier/payments${username ? `/${username}` : ''}`;
}

/** Учётная запись получателя уведомления: почта и подписка в Центре уведомлений. */
interface RecipientDirectory extends ChairmanDirectory {
  getAccount(username: string): Promise<{ provider_account?: { email?: string | null; subscriber_id?: string | null } | null }>;
  getDisplayName(username: string): Promise<string>;
}

interface CashDeskNotifier {
  notify(input: {
    coopname: string;
    workflowId: string;
    to: { subscriberId: string; email: string; username: string };
    payload: Record<string, unknown>;
  }): Promise<unknown>;
}

interface CashDeskLogger {
  warn(message: string): void;
}

export interface CashDeskTask {
  coopname: string;
  workflowId: string;
  /** Данные уведомления для одного получателя: его имя приходит готовым. */
  payloadFor(recipientName: string): Record<string, unknown>;
}

/**
 * Разослать задачу кассы — «проверьте и подтвердите платёж» — председателю и
 * кассирам. Получатель без почты или подписки пропускается с предупреждением,
 * остальные получают задачу. Возвращает, скольким она ушла.
 */
export async function notifyCashDesk(
  deps: { accounts: RecipientDirectory; roles: RoleHolders; notifications: CashDeskNotifier; logger: CashDeskLogger },
  task: CashDeskTask
): Promise<number> {
  const recipients = await cashDeskConfirmers(deps.accounts, deps.roles);
  if (recipients.length === 0) deps.logger.warn('Председатель и кассиры не найдены, задача кассы не отправлена');
  let sent = 0;
  for (const username of recipients) {
    const account = await deps.accounts.getAccount(username);
    const email = account.provider_account?.email;
    const subscriberId = account.provider_account?.subscriber_id?.trim();
    if (!email || !subscriberId) {
      deps.logger.warn(`У ${username} нет почты или подписки на уведомления, задача кассы пропущена`);
      continue;
    }
    const payload = task.payloadFor(await deps.accounts.getDisplayName(username));
    await deps.notifications.notify({ coopname: task.coopname, workflowId: task.workflowId, to: { subscriberId, email, username }, payload });
    sent++;
  }
  return sent;
}
