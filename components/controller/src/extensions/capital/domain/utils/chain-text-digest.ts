import { isChainTextDigest, isChainTextOf } from '@coopenomics/extension-kit';

/**
 * Тексты проекта (описание, приглашение) в цепи хранятся хешем — общее правило в
 * extension-kit (blockchain/chain-text-digest.ts). Здесь то, что относится к проекту:
 * какие поля хешируются и как сверить текст в базе с хешем в цепи.
 */

/** Поля проекта, которые в цепи хранятся хешем. */
export const PROJECT_CHAIN_TEXT_FIELDS = ['description', 'invite'] as const;
export type ProjectChainTextField = (typeof PROJECT_CHAIN_TEXT_FIELDS)[number];
export type ProjectChainTexts = Partial<Record<ProjectChainTextField, string>>;

/**
 * Поля, где текст в базе не сходится с хешем в цепи. Пустой хеш в цепи при непустом
 * тексте тоже расхождение: значит, текст в базе появился мимо цепи.
 */
export function chainTextMismatches(
  chain: Record<ProjectChainTextField, string>,
  texts: ProjectChainTexts
): ProjectChainTextField[] {
  return PROJECT_CHAIN_TEXT_FIELDS.filter((field) => {
    const chainValue = chain[field] ?? '';
    if (!isChainTextDigest(chainValue) && chainValue !== '') return false;
    return !isChainTextOf(texts[field], chainValue);
  });
}
