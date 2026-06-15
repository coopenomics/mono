import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { Cooperative } from 'cooptypes';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import {
  generateExpenseProposalStatementDocument,
  createExpenseProposal,
} from '../api';

export interface ICreateProposalDraftItem {
  number: string;
  description: string;
  amount: string;
  recipient_type: 'SELF' | 'MEMBER' | 'ORG';
  mechanics: 'ADVANCE' | 'DIRECT';
  recipient_name?: string;
  requisites?: string;
  /** Назначение платежа (оплата по счёту организации/ИП). */
  payment_purpose?: string;
  item_hash?: string;
  recipient_account?: string;
}

export interface ICreateProposalDraft {
  source_wallet: string;
  description: string;
  /** Срок исполнения («в срок до»), значение date-input `YYYY-MM-DD`. */
  deadline: string;
  items: ICreateProposalDraftItem[];
}

export function useExpenseProposalActions() {
  const { info } = useSystemStore();
  const session = useSessionStore();

  async function submitProposal(draft: ICreateProposalDraft) {
    const proposal_hash = await generateUniqueHash();

    const totalAmount = draft.items.reduce((sum, it) => sum + parseFloat(it.amount || '0'), 0);
    const total_amount = `${totalAmount.toFixed(4)} RUB`;

    const itemsForDoc = draft.items.map((it, idx) => ({
      number: String(idx + 1),
      description: it.description,
      amount: `${parseFloat(it.amount || '0').toFixed(4)} RUB`,
      recipient_type: it.recipient_type,
      mechanics: it.mechanics,
      recipient_name: it.recipient_name ?? '',
      requisites: it.requisites ?? '',
      payment_purpose: it.payment_purpose || undefined,
    }));

    const proposalHeader = {
      description: draft.description,
      total_amount,
      items_count: draft.items.length,
      source_wallet: draft.source_wallet,
      deadline: formatDeadline(draft.deadline),
    };

    const generated = await generateExpenseProposalStatementDocument({
      coopname: info.coopname,
      username: session.username,
      proposal_hash,
      proposal: proposalHeader,
      items: itemsForDoc,
    } as any);

    const docKey = 'generateExpenseProposalStatementDocument' as const;
    const generatedDoc = (generated as any)[docKey];

    const digital = new DigitalDocument(generatedDoc);
    const signed = await digital.sign<Cooperative.Registry.ExpenseProposalStatement.Meta>(
      session.username,
      1,
    );

    const itemsForChain = draft.items.map((it, idx) => ({
      item_hash: it.item_hash ?? generateItemHash(proposal_hash, idx),
      mechanics: it.mechanics,
      recipient_type: it.recipient_type,
      recipient: it.recipient_account ?? it.recipient_name ?? session.username,
      description: it.description,
      planned_amount: it.amount,
      payment_purpose: it.payment_purpose || undefined,
    }));

    return createExpenseProposal({
      coopname: info.coopname,
      username: session.username,
      proposal_hash,
      source_wallet: draft.source_wallet,
      items: itemsForChain,
      statement: signed as any,
    } as any);
  }

  return { submitProposal };
}

function generateItemHash(proposal_hash: string, idx: number): string {
  return `${proposal_hash.slice(0, 56)}${idx.toString(16).padStart(8, '0')}`;
}

/** `YYYY-MM-DD` (date-input) → `DD.MM.YYYY` (документ). */
function formatDeadline(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}
