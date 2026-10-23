import type { IMonoAccount } from '@coopenomics/innercoop';
import type { ExpenseProposalDomainEntity } from '../entities/expense-proposal.entity';

/**
 * Кому служебная записка и её файлы принадлежат лично: подавшему записку и
 * получателю строки (без строки — любому получателю записки). Совет, кассир и
 * ревизор читают любую записку по праву реестра расходов — это проверяют
 * вызывающие (`ExpensesRights.readsRegistry`). Право операции этого не
 * различает: по нему проходит любой принятый пайщик, а реквизиты, платёжки и
 * чеки чужого расхода ему не принадлежат.
 */
export function mayReadExpenseProposal(
  user: Pick<IMonoAccount, 'username'>,
  proposal: ExpenseProposalDomainEntity | null,
  itemHash: string | null = null
): boolean {
  if (!proposal) return false;
  if (proposal.username === user.username) return true;
  const items = proposal.items ?? [];
  return itemHash
    ? items.some((i) => i.item_hash?.toLowerCase() === itemHash.toLowerCase() && i.recipient === user.username)
    : items.some((i) => i.recipient === user.username);
}

/** Получатель ли пайщик этой строки расхода. */
export function isItemRecipient(
  user: Pick<IMonoAccount, 'username'>,
  proposal: ExpenseProposalDomainEntity | null,
  itemHash: string | null | undefined
): boolean {
  if (!proposal || !itemHash) return false;
  return (proposal.items ?? []).some((i) => i.item_hash?.toLowerCase() === itemHash.toLowerCase() && i.recipient === user.username);
}
