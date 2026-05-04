// push: только staging; remote_updated_at из индекса должен совпасть с сервером.

import type { AuthenticatedContext } from '../session/index.js'
import * as fs from 'node:fs/promises'

import * as path from 'node:path'

import { Mutations, Queries } from '@coopenomics/sdk'
import { parseBlagoMarkdown } from '../format/index.js'
import { sha256Hex } from '../lib/hash.js'
import { effectiveParentHash } from '../lib/parent-hash.js'
import { warn } from '../ui/output.js'
import { validateParsedForPush } from '../validate/index.js'
import { assertSameRemoteVersion } from './conflicts.js'
import {
  findByHash,
  loadIndex,
  loadStaging,
  normalizeRelativePath,
  saveIndex,
  saveStaging,
  upsertEntry,
} from './index-store.js'
import { pendingKindForEntityType } from './pending-create.js'
import { isPullOnlyCommunicationRelativePath } from './pull-only-paths.js'
import {
  findPendingForParsed,
  pushCreateIssue,
  pushCreateStory,
} from './push-create.js'
import { writeWorkspaceIndexMarkdown } from './workspace-index.js'

// Ответы GraphQL/Zeus часто дают _updated_at как unknown — сужаем безопасно.
function toIso(v: unknown): string {
  if (v === undefined || v === null) {
    return ''
  }
  if (v instanceof Date) {
    return v.toISOString()
  }
  if (typeof v === 'string') {
    return new Date(v).toISOString()
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return new Date(v).toISOString()
  }
  return ''
}

export async function runPush(ctx: AuthenticatedContext): Promise<void> {
  let staging = await loadStaging(ctx.root)
  const pullOnlyInStaging = staging.paths.filter(p => isPullOnlyCommunicationRelativePath(p))
  if (pullOnlyInStaging.length > 0) {
    const kept = staging.paths.filter(p => !isPullOnlyCommunicationRelativePath(p))
    await saveStaging(ctx.root, { paths: [...new Set(kept.map(p => normalizeRelativePath(p)))].sort() })
    for (const p of pullOnlyInStaging) {
      warn(`Убрано из staging (артефакты только pull — messages/ и meetings/): ${normalizeRelativePath(p)}`)
    }
    staging = await loadStaging(ctx.root)
  }
  if (staging.paths.length === 0) {
    throw new Error('Нечего отправлять. Добавьте файлы: blago add <путь | id проекта | projectId-issueId>')
  }
  const index = await loadIndex(ctx.root)

  const normalizedList = [...new Set(staging.paths.map(p => normalizeRelativePath(p)))]
  const remaining = new Set(normalizedList)

  for (const rel of normalizedList) {
    const n = rel
    if (isPullOnlyCommunicationRelativePath(n)) {
      throw new Error(
        `Файл «${n}» не отправляется на сервер (переписка/транскрипции). Уберите из staging: blago remove «${n}»`,
      )
    }
    const abs = path.join(ctx.root, n)
    const raw = await fs.readFile(abs, 'utf8')
    const parsed = parseBlagoMarkdown(raw)
    const { type, hash } = validateParsedForPush(parsed)
    const entry = findByHash(index, type, hash)
    const pKind = pendingKindForEntityType(type)
    const pending = pKind ? await findPendingForParsed(ctx.root, pKind, hash) : undefined

    if (entry && pending) {
      throw new Error(
        `Файл «${n}»: сущность ${type} уже в индексе, но есть запись pending-create. Удалите pending-create.json вручную или выполните pull.`,
      )
    }

    if (!entry && pending) {
      if (normalizeRelativePath(pending.relative_path) !== n) {
        throw new Error(
          `Файл «${n}» не совпадает с путём в pending-create («${pending.relative_path}»).`,
        )
      }
      if (type === 'issue') {
        await pushCreateIssue(ctx, index, n, parsed, pending)
      }
      else if (type === 'story') {
        await pushCreateStory(ctx, index, n, parsed, pending)
      }
      remaining.delete(n)
      continue
    }

    if (!entry) {
      throw new Error(
        `Файл «${n}»: сущность ${type} ${hash} не в индексе. Выполните «blago pull» или «blago create» и снова add.`,
      )
    }
    if (normalizeRelativePath(entry.relative_path) !== n) {
      throw new Error(
        `Файл «${n}» не совпадает с каноническим путём в индексе «${entry.relative_path}». Выполните «blago pull» для выравнивания путей.`,
      )
    }

    const etag = sha256Hex(raw)

    if (type === 'project') {
      const coopname = String(parsed.data.coopname ?? '')
      const rawParent = parsed.data.parent_hash
      const parentHash = effectiveParentHash(
        rawParent === undefined || rawParent === null ? undefined : String(rawParent),
      )
      const projectQuery = await ctx.client.Query(
        Queries.Capital.GetProject.query,
        {
          variables: {
            data: {
              hash,
              parent_hash: parentHash,
            },
          },
        },
      )
      const remote = projectQuery[Queries.Capital.GetProject.name]
      if (remote == null) {
        throw new Error(`Проект «${hash}» не найден на сервере.`)
      }
      assertSameRemoteVersion(entry.remote_updated_at, toIso(remote._updated_at), `проект ${hash}`)
      const projectData: Mutations.Capital.EditProject.IInput['data'] = {
        coopname,
        project_hash: hash,
        title: String(parsed.data.title ?? ''),
        description: parsed.body,
        data: remote.data ?? '',
        meta: remote.meta ?? '',
        invite: remote.invite ?? '',
      }
      await ctx.client.Mutation(
        Mutations.Capital.EditProject.mutation,
        {
          variables: {
            data: projectData,
          },
        },
      )
      const projectAfterQuery = await ctx.client.Query(
        Queries.Capital.GetProject.query,
        {
          variables: {
            data: {
              hash,
              parent_hash: parentHash,
            },
          },
        },
      )
      const after = projectAfterQuery[Queries.Capital.GetProject.name]
      if (after == null) {
        throw new Error(`Проект «${hash}» не найден на сервере после сохранения.`)
      }
      upsertEntry(index, {
        entity_type: 'project',
        entity_hash: hash,
        relative_path: entry.relative_path,
        remote_updated_at: toIso(after._updated_at),
        content_etag_local: etag,
      })
    }
    else if (type === 'issue') {
      const issueQuery = await ctx.client.Query(
        Queries.Capital.GetIssue.query,
        {
          variables: {
            data: { issue_hash: hash },
          },
        },
      )
      const remote = issueQuery[Queries.Capital.GetIssue.name]
      if (remote == null) {
        throw new Error(`Задача «${hash}» не найдена на сервере.`)
      }
      assertSameRemoteVersion(entry.remote_updated_at, toIso(remote._updated_at), `задача ${hash}`)
      const creators = Array.isArray(parsed.data.creators)
        ? (parsed.data.creators as unknown[]).map(x => String(x))
        : []
      const labels = Array.isArray(parsed.data.labels)
        ? (parsed.data.labels as unknown[]).map(x => String(x))
        : []
      /** Только поля GraphQL UpdateIssueInput (schema.gql); лишние ключи ломают capitalUpdateIssue. */
      const issueData: Mutations.Capital.UpdateIssue.IInput['data'] = {
        issue_hash: hash,
        title: String(parsed.data.title ?? ''),
        description: parsed.body,
        status: parsed.data.status as Mutations.Capital.UpdateIssue.IInput['data']['status'],
        priority: parsed.data.priority as Mutations.Capital.UpdateIssue.IInput['data']['priority'],
        estimate: Number(parsed.data.estimate ?? 0),
        sort_order: Number(parsed.data.sort_order ?? 0),
        creators,
        labels,
      }
      if (parsed.data.cycle_id) {
        issueData.cycle_id = String(parsed.data.cycle_id)
      }
      if (parsed.data.submaster) {
        issueData.submaster = String(parsed.data.submaster)
      }
      const issueMutation = await ctx.client.Mutation(
        Mutations.Capital.UpdateIssue.mutation,
        {
          variables: {
            data: issueData,
          },
        },
      )
      const updated = issueMutation[Mutations.Capital.UpdateIssue.name]
      if (updated == null) {
        throw new Error(`Не удалось обновить задачу «${hash}» (пустой ответ мутации).`)
      }
      upsertEntry(index, {
        entity_type: 'issue',
        entity_hash: hash,
        relative_path: entry.relative_path,
        remote_updated_at: toIso(updated._updated_at),
        content_etag_local: etag,
      })
    }
    else if (type === 'story') {
      const storyQuery = await ctx.client.Query(
        Queries.Capital.GetStory.query,
        {
          variables: {
            data: { story_hash: hash },
          },
        },
      )
      const remote = storyQuery[Queries.Capital.GetStory.name]
      if (remote == null) {
        throw new Error(`Требование «${hash}» не найдено на сервере.`)
      }
      assertSameRemoteVersion(entry.remote_updated_at, toIso(remote._updated_at), `требование ${hash}`)
      const storyData: Mutations.Capital.UpdateStory.IInput['data'] = {
        story_hash: hash,
        title: String(parsed.data.title ?? ''),
        description: parsed.body,
        content_format: parsed.data.content_format as Mutations.Capital.UpdateStory.IInput['data']['content_format'],
        status: parsed.data.status as Mutations.Capital.UpdateStory.IInput['data']['status'],
        sort_order: Number(parsed.data.sort_order ?? 0),
      }
      if (parsed.data.project_hash) {
        storyData.project_hash = String(parsed.data.project_hash)
      }
      if (parsed.data.issue_hash) {
        storyData.issue_hash = String(parsed.data.issue_hash)
      }
      const storyMutation = await ctx.client.Mutation(
        Mutations.Capital.UpdateStory.mutation,
        {
          variables: {
            data: storyData,
          },
        },
      )
      const updated = storyMutation[Mutations.Capital.UpdateStory.name]
      if (updated == null) {
        throw new Error(`Не удалось обновить требование «${hash}» (пустой ответ мутации).`)
      }
      upsertEntry(index, {
        entity_type: 'story',
        entity_hash: hash,
        relative_path: entry.relative_path,
        remote_updated_at: toIso(updated._updated_at),
        content_etag_local: etag,
      })
    }

    remaining.delete(n)
  }

  await saveIndex(ctx.root, index)
  await saveStaging(ctx.root, { paths: [...remaining] })
  await writeWorkspaceIndexMarkdown(ctx.root)
}
