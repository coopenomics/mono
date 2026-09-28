import type { IMonoAccount } from '@coopenomics/innercoop';
import type { ExpenseProposalDomainEntity } from '../entities/expense-proposal.entity';

/**
 * Кому открыта служебная записка на расход и её файлы: совету, подавшему
 * записку и получателю строки (без строки — любому получателю записки).
 * Роль в guard'е этого не различает: по ней проходит любой принятый пайщик,
 * а реквизиты, платёжки и чеки чужого расхода ему не принадлежат.
 */
export function mayReadExpenseProposal(
  user: IMonoAccount,
  proposal: ExpenseProposalDomainEntity | null,
  itemHash: string | null = null
): boolean {
  if (user.role === 'chairman' || user.role === 'member') return true;
  if (!proposal) return false;
  if (proposal.username === user.username) return true;
  const items = proposal.items ?? [];
  return itemHash
    ? items.some((i) => i.item_hash?.toLowerCase() === itemHash.toLowerCase() && i.recipient === user.username)
    : items.some((i) => i.recipient === user.username);
}
