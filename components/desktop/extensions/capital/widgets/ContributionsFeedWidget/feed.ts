import { Zeus } from '@coopenomics/sdk';
import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge/BaseBadge.types';
import type { IProgramProperty } from 'app/extensions/capital/features/ProgramProperty';
import type { IContribution } from 'app/extensions/capital/entities/Contribution';
import { t } from '../../i18n';

const Status = Zeus.ProgramPropertyStatus;
const Kind = Zeus.CapitalContributionKind;

export type FeedKind = 'money' | 'property' | 'result' | 'import';

export interface FeedStatus {
  label: string;
  variant: BaseBadgeVariant;
  /** Что дальше — только новое к бейджу, без повтора его слов. */
  note?: string;
}

/** Запись ленты «Мои взносы»: внесённый взнос или взнос имуществом на рассмотрении. */
export interface FeedItem {
  key: string;
  kind: FeedKind;
  title: string;
  /** Что именно внесено — для имущества его наименование. */
  subject: string | null;
  amount: string;
  date: string;
  status: FeedStatus;
  property?: IProgramProperty;
  contribution?: IContribution;
}

const KIND_BY_LEDGER: Record<string, FeedKind> = {
  [Kind.MONEY]: 'money',
  [Kind.PROPERTY]: 'property',
  [Kind.RESULT]: 'result',
  [Kind.IMPORT]: 'import',
};

export function titleOf(kind: FeedKind): string {
  return t(`capital.contributionsFeed.kind.${kind}`);
}

export function propertyStatusOf(p: IProgramProperty): FeedStatus {
  switch (p.status) {
    case Status.CREATED:
      return { label: t('capital.contributionsFeed.status.created'), variant: 'info', note: t('capital.contributionsFeed.note.created') };
    case Status.APPROVED:
      return { label: t('capital.contributionsFeed.status.approved'), variant: 'info', note: t('capital.contributionsFeed.note.approved') };
    case Status.AUTHORIZED:
      return { label: t('capital.contributionsFeed.status.authorized'), variant: 'warn', note: t('capital.contributionsFeed.note.authorized') };
    case Status.ACT1:
      return { label: t('capital.contributionsFeed.status.act1'), variant: 'info', note: t('capital.contributionsFeed.note.act1') };
    case Status.ACT2:
      return { label: t('capital.contributionsFeed.status.accepted'), variant: 'pos' };
    case Status.DECLINED:
      return { label: t('capital.contributionsFeed.status.declined'), variant: 'neg' };
    default:
      return { label: t('capital.contributionsFeed.status.unknown'), variant: 'neutral' };
  }
}

/**
 * Одна лента: взносы имуществом во всех статусах и внесённое по книге учёта
 * (деньги, результаты, перенесённые взносы). Принятое имущество книга учёта
 * тоже показывает — такую запись заменяет строка самого взноса имуществом,
 * чтобы один взнос не стоял в ленте дважды. Новые сверху.
 */
export function buildFeed(properties: IProgramProperty[], contributions: IContribution[]): FeedItem[] {
  const propertyHashes = new Set(properties.map((p) => p.property_hash.toLowerCase()));

  const fromProperties: FeedItem[] = properties.map((p) => ({
    key: `property:${p.property_hash}`,
    kind: 'property',
    title: titleOf('property'),
    subject: p.property_name || p.property_description || null,
    amount: p.property_amount ?? '',
    date: p.created_at ?? p._created_at,
    status: propertyStatusOf(p),
    property: p,
  }));

  const fromLedger: FeedItem[] = contributions
    .filter((c) => !(c.kind === Kind.PROPERTY && c.process_hash && propertyHashes.has(c.process_hash.toLowerCase())))
    .map((c) => {
      const kind = KIND_BY_LEDGER[c.kind] ?? 'money';
      return {
        key: `ledger:${c.id}`,
        kind,
        title: titleOf(kind),
        subject: null,
        amount: c.amount,
        date: c.created_at,
        status: { label: t('capital.contributionsFeed.status.contributed'), variant: 'pos' },
        contribution: c,
      };
    });

  return [...fromProperties, ...fromLedger].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
