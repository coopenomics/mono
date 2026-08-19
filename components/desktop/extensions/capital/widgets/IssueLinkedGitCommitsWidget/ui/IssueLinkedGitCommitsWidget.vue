<template lang="pug">
.linked-git-commits(v-if='commits.length')
  .text-center.linked-git-commits__title {{ title }}
  .linked-git-commits__list.column.q-gutter-sm
    .linked-git-commit-card(
      v-for='(row, idx) in commits'
      :key='`${row.github_sha}-${idx}`'
    )
      .row.items-center.wrap.q-gutter-xs
        a.linked-git-commit-card__sha(
          :href='row.html_url'
          target='_blank'
          rel='noopener noreferrer'
        ) {{ shortSha(row.github_sha) }}
        span.text-grey-7.text-body2 {{ row.username }}
        q-chip(
          v-if='row.consumed'
          dense
          size='sm'
          outline
          color='grey-7'
        ) Учтён в взносе
        BaseChip(
          v-if='row.branch && !row.in_default_branch'
          variant='warn'
          size='sm'
        )
          q-icon.q-mr-xs(name='call_split' size='14px')
          | {{ row.branch }}
          q-tooltip Коммит ещё не дошёл до базовой ветки репозитория
      .linked-git-commit-card__meta.text-caption.text-grey-6.q-mt-xs {{ formatCommitted(row.committed_at) }}
      pre.linked-git-commit-card__message(v-if='row.commit_message') {{ row.commit_message }}
</template>

<script lang="ts" setup>
import type { Zeus } from '@coopenomics/sdk';
import { BaseChip } from 'src/shared/ui/base';

type CapitalIssueLinkedGitCommit = Zeus.ModelTypes['CapitalIssueLinkedGitCommit'];

withDefaults(
  defineProps<{
    commits: CapitalIssueLinkedGitCommit[];
    /** Заголовок секции; пустая строка — без заголовка */
    title?: string;
  }>(),
  {
    title: 'Связанные коммиты',
  },
);

const shortSha = (sha: string) => (sha?.length > 7 ? sha.slice(0, 7) : sha);

const formatCommitted = (d: string | Date) =>
  new Date(d).toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
</script>

<style lang="scss" scoped>
.linked-git-commits__title {
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: rgba(0, 0, 0, 0.72);
  margin-bottom: 10px;
}

.body--dark .linked-git-commits__title,
.q-dark .linked-git-commits__title {
  color: rgba(255, 255, 255, 0.82);
}

.linked-git-commit-card {
  border-radius: 10px;
  padding: 12px 14px;
  background: rgba(0, 0, 0, 0.035);
  transition: background 0.15s ease;
}

.body--dark .linked-git-commit-card,
.q-dark .linked-git-commit-card {
  background: rgba(255, 255, 255, 0.06);
}

.linked-git-commit-card__sha {
  font-family: ui-monospace, 'SF Mono', 'Courier New', monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--q-primary);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.linked-git-commit-card__meta {
  line-height: 1.25;
}

.linked-git-commit-card__message {
  margin: 10px 0 0;
  padding: 10px 12px;
  font-family: ui-monospace, 'SF Mono', 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(0, 0, 0, 0.045);
  border-radius: 8px;
  max-height: 240px;
  overflow: auto;
}

.body--dark .linked-git-commit-card__message,
.q-dark .linked-git-commit-card__message {
  background: rgba(0, 0, 0, 0.25);
}
</style>
