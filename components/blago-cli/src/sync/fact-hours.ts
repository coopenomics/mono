// Факт часов по задаче: frontmatter fact_hours ↔ capitalAddWorklog.

import type { AuthenticatedContext } from '../session/index.js'

import { Mutations, Queries } from '@coopenomics/sdk'

import {
  type IssueFactHoursEntry,
  parseFactHoursFromFrontmatter,
  resolveFactHoursFromContributors,
} from '../format/index.js'
import { info, warn } from '../ui/output.js'

/** Мин. дельта для capitalAddWorklog (бэкенд @Min(0.01)). */
const WORKLOG_MIN_HOURS = 0.01

export async function loadContributorUsernameByHash(
  ctx: AuthenticatedContext,
  coopname: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let page = 1
  for (;;) {
    const { [Queries.Capital.GetContributors.name]: pageResult } = await ctx.client.Query(
      Queries.Capital.GetContributors.query,
      {
        variables: {
          filter: { coopname },
          options: { limit: 200, page, sortOrder: 'DESC' },
        },
      },
    )
    for (const c of pageResult.items as Array<{ contributor_hash?: string | null, username?: string | null }>) {
      const hash = c.contributor_hash !== undefined && c.contributor_hash !== null
        ? String(c.contributor_hash).trim().toLowerCase()
        : ''
      const username = c.username !== undefined && c.username !== null ? String(c.username).trim() : ''
      if (hash !== '' && username !== '') {
        map.set(hash, username)
      }
    }
    if (page >= pageResult.totalPages) {
      break
    }
    page += 1
  }
  return map
}

function remoteHoursByUsername(
  factByContributor: ReadonlyArray<{ contributor_hash: string, hours: number }> | null | undefined,
  usernameByHash: ReadonlyMap<string, string>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const row of factByContributor ?? []) {
    const username = usernameByHash.get(String(row.contributor_hash).trim().toLowerCase())
    if (!username) {
      continue
    }
    const key = username.toLowerCase()
    out.set(key, (out.get(key) ?? 0) + Number(row.hours))
  }
  return out
}

/**
 * Добивает факт на сервере до целевых часов из frontmatter (только добавление).
 * Если ключ fact_hours отсутствует — no-op. Урезание на сервере не поддерживается.
 */
export async function pushFactHoursDeltas(opts: {
  readonly ctx: AuthenticatedContext
  readonly coopname: string
  readonly issueHash: string
  readonly label: string
  readonly localData: Record<string, unknown>
  readonly remoteFactByContributor?: ReadonlyArray<{ contributor_hash: string, hours: number }> | null
  readonly usernameByHash: ReadonlyMap<string, string>
}): Promise<void> {
  let local: IssueFactHoursEntry[]
  try {
    const parsed = parseFactHoursFromFrontmatter(opts.localData)
    if (parsed === undefined) {
      return
    }
    local = parsed
  }
  catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`${opts.label}: ${msg}`)
  }

  const remoteByUser = remoteHoursByUsername(opts.remoteFactByContributor, opts.usernameByHash)

  for (const entry of local) {
    const remoteHours = remoteByUser.get(entry.username.toLowerCase()) ?? 0
    const delta = Math.round((entry.hours - remoteHours) * 100) / 100
    if (delta >= WORKLOG_MIN_HOURS) {
      await opts.ctx.client.Mutation(Mutations.Capital.AddWorklog.mutation, {
        variables: {
          data: {
            coopname: opts.coopname,
            username: entry.username,
            issue_hash: opts.issueHash,
            hours: delta,
          },
        },
      })
      info(`${opts.label}: факт +${delta} ч для ${entry.username} (цель ${entry.hours}, было ${remoteHours})`)
      continue
    }
    if (delta < -WORKLOG_MIN_HOURS) {
      warn(
        `${opts.label}: у ${entry.username} на сервере ${remoteHours} ч, в файле ${entry.hours} ч — уменьшение факта через blago не поддерживается, пропуск`,
      )
    }
  }
}

/** Для pull/restore: fact_by_contributor → fact_hours с предупреждением о неизвестных hash. */
export function factHoursForIssueFile(
  factByContributor: ReadonlyArray<{ contributor_hash: string, hours: number }> | null | undefined,
  usernameByHash: ReadonlyMap<string, string>,
  label: string,
): IssueFactHoursEntry[] {
  const unknown: string[] = []
  for (const row of factByContributor ?? []) {
    const hash = String(row.contributor_hash).trim().toLowerCase()
    if (hash !== '' && !usernameByHash.has(hash)) {
      unknown.push(hash.slice(0, 12))
    }
  }
  if (unknown.length > 0) {
    warn(`${label}: нет username для contributor_hash (${[...new Set(unknown)].join(', ')}…) — эти часы не попадут в fact_hours`)
  }
  return resolveFactHoursFromContributors(factByContributor, usernameByHash)
}
