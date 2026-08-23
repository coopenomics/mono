// push: только staging; base_rev из индекса уходит на сервер, который сливает правку с параллельными
// изменениями (слитый текст возвращается и записывается в файл) либо отвечает конфликтом.

import type { AuthenticatedContext } from '../session/index.js'
import * as fs from 'node:fs/promises'

import * as path from 'node:path'

import { Mutations, Queries, Zeus } from '@coopenomics/sdk'
import { resolveCoopname } from '../config/index.js'
import { parseBlagoMarkdown, peekBlagoEntityType, serializeBlagoMarkdown } from '../format/index.js'
import { sha256Hex } from '../lib/hash.js'
import { effectiveParentHash } from '../lib/parent-hash.js'
import { info, warn } from '../ui/output.js'
import { validateParsedForPush } from '../validate/index.js'
import { loadContributorUsernameByHash, pushFactHoursDeltas } from './fact-hours.js'
import {
  findByHash,
  loadIndex,
  loadStaging,
  normalizeRelativePath,
  saveIndex,
  saveStaging,
  upsertEntry,
} from './index-store.js'
import { extractServerContentConflict, saveBaseSnapshot, type ServerContentConflict } from './merge3.js'
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

const ORIGIN_CLI = Zeus.CapitalContentRevisionOrigin.CLI

/**
 * После записи сервер вернул итоговый текст: если он отличается от отправленного (слияние
 * с параллельной правкой), переписываем файл — локальная копия всегда равна серверной.
 * Возвращает актуальное содержимое файла (для etag и снимка базы).
 */
async function applyServerText(params: {
  abs: string
  raw: string
  parsed: ReturnType<typeof parseBlagoMarkdown>
  serverTitle: string
  serverBody: string
  label: string
}): Promise<string> {
  const { abs, raw, parsed, serverTitle, serverBody, label } = params
  const sentTitle = String(parsed.data.title ?? '')
  if (serverBody === parsed.body && serverTitle === sentTitle) {
    return raw
  }
  const data = { ...parsed.data, title: serverTitle }
  const next = serializeBlagoMarkdown(data, serverBody)
  await fs.writeFile(abs, next, 'utf8')
  info(`${label}: сервер слил вашу правку с параллельными изменениями, файл обновлён итоговым текстом.`)
  return next
}

/**
 * Сервер не смог слить автоматически: в файл записывается тело с маркерами (если есть),
 * индекс/стейджинг сохраняются, push останавливается с понятной инструкцией.
 */
async function writeConflictAndFail(params: {
  root: string
  abs: string
  parsed: ReturnType<typeof parseBlagoMarkdown>
  conflict: ServerContentConflict
  label: string
  index: Awaited<ReturnType<typeof loadIndex>>
  remaining: Set<string>
}): Promise<never> {
  const { root, abs, parsed, conflict, label, index, remaining } = params
  const body = conflict.marked
    || `<<<<<<< blago/local\n${conflict.ours.description}\n=======\n${conflict.theirs.description}\n>>>>>>> blago/remote\n`
  await fs.writeFile(abs, serializeBlagoMarkdown({ ...parsed.data }, body), 'utf8')
  await saveIndex(root, index)
  await saveStaging(root, { paths: [...remaining] })
  const titleNote = conflict.title_conflict
    ? ` Заголовок тоже разошёлся: локально «${conflict.ours.title}», на сервере «${conflict.theirs.title}» — поправьте title во frontmatter.`
    : ''
  throw new Error(
    `Конфликт редакций для ${label}: документ изменён параллельно (сервер: редакция ${conflict.current_rev}, вы начинали с ${conflict.base_rev}), правки пересеклись. В файл записаны маркеры слияния («<<<<<<< blago/local» … «>>>>>>> blago/remote»): оставьте одну версию, удалите маркеры, затем «blago add» и «blago push».${titleNote}`,
  )
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
  // Не-сущности (README/notes/CLAUDE/AGENTS и пр., в .md без type=project|issue|story) тоже не должны валить весь push.
  // Чистим их автоматически — иначе одна забытая заметка блокирует отправку реальных правок.
  const stagingAbs = (p: string): string => path.join(ctx.root, normalizeRelativePath(p))
  const nonEntityInStaging: string[] = []
  for (const p of staging.paths) {
    try {
      const raw = await fs.readFile(stagingAbs(p), 'utf8')
      if (peekBlagoEntityType(raw) === undefined) {
        nonEntityInStaging.push(normalizeRelativePath(p))
      }
    }
    catch {
      // нечитаемый файл — пусть основной цикл бросит понятную ошибку с путём
    }
  }
  if (nonEntityInStaging.length > 0) {
    const drop = new Set(nonEntityInStaging)
    const kept = staging.paths.filter(p => !drop.has(normalizeRelativePath(p)))
    await saveStaging(ctx.root, { paths: [...new Set(kept.map(p => normalizeRelativePath(p)))].sort() })
    for (const p of nonEntityInStaging) {
      warn(`Убрано из staging (нет blago-frontmatter type=project|issue|story): ${p}`)
    }
    staging = await loadStaging(ctx.root)
  }
  if (staging.paths.length === 0) {
    throw new Error('Нечего отправлять. Добавьте файлы: blago add <путь | id проекта | projectId-issueId>')
  }
  const index = await loadIndex(ctx.root)
  const coopname = resolveCoopname(ctx.config)
  if (!coopname) {
    throw new Error(
      'Укажите coopname в .blago/config.json в environments.<активнаяСреда> (или запасной «coopname» сверху), либо: blago init --coopname <имя>',
    )
  }
  const usernameByHash = await loadContributorUsernameByHash(ctx, coopname)

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
    let parsed: ReturnType<typeof parseBlagoMarkdown>
    try {
      parsed = parseBlagoMarkdown(raw)
    }
    catch (err) {
      // Без префикса путём из staging вылезает «type: undefined» без указания файла.
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Файл «${n}»: ${msg}`)
    }
    let type: ReturnType<typeof validateParsedForPush>['type']
    let hash: string
    try {
      ({ type, hash } = validateParsedForPush(parsed))
    }
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`Файл «${n}»: ${msg}`)
    }
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
      const projectData: Mutations.Capital.EditProject.IInput['data'] = {
        coopname,
        project_hash: hash,
        title: String(parsed.data.title ?? ''),
        description: parsed.body,
        data: remote.data ?? '',
        meta: remote.meta ?? '',
        invite: remote.invite ?? '',
        base_rev: entry.remote_rev,
        origin: ORIGIN_CLI,
      }
      try {
        await ctx.client.Mutation(
          Mutations.Capital.EditProject.mutation,
          {
            variables: {
              data: projectData,
            },
          },
        )
      }
      catch (err) {
        const conflict = extractServerContentConflict(err)
        if (conflict) {
          await writeConflictAndFail({ root: ctx.root, abs, parsed, conflict, label: `проект ${hash}`, index, remaining })
        }
        throw err
      }
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
      const finalRaw = await applyServerText({
        abs,
        raw,
        parsed,
        serverTitle: String(after.title ?? ''),
        serverBody: String(after.description ?? ''),
        label: `проект ${hash}`,
      })
      upsertEntry(index, {
        entity_type: 'project',
        entity_hash: hash,
        relative_path: entry.relative_path,
        remote_updated_at: toIso(after._updated_at),
        remote_rev: after.content_rev ?? undefined,
        content_etag_local: sha256Hex(finalRaw),
      })
      await saveBaseSnapshot(ctx.root, 'project', hash, finalRaw)
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
        base_rev: entry.remote_rev,
        origin: ORIGIN_CLI,
      }
      if (parsed.data.cycle_id) {
        issueData.cycle_id = String(parsed.data.cycle_id)
      }
      if (parsed.data.submaster) {
        issueData.submaster = String(parsed.data.submaster)
      }
      let issueMutation: Mutations.Capital.UpdateIssue.IOutput
      try {
        issueMutation = await ctx.client.Mutation(
          Mutations.Capital.UpdateIssue.mutation,
          {
            variables: {
              data: issueData,
            },
          },
        )
      }
      catch (err) {
        const conflict = extractServerContentConflict(err)
        if (conflict) {
          await writeConflictAndFail({ root: ctx.root, abs, parsed, conflict, label: `задача ${hash}`, index, remaining })
        }
        throw err
      }
      const updated = issueMutation[Mutations.Capital.UpdateIssue.name]
      if (updated == null) {
        throw new Error(`Не удалось обновить задачу «${hash}» (пустой ответ мутации).`)
      }
      const remoteFact = remote as {
        fact_by_contributor?: Array<{ contributor_hash: string, hours: number }> | null
      }
      await pushFactHoursDeltas({
        ctx,
        coopname,
        issueHash: hash,
        label: `задача ${hash}`,
        localData: parsed.data,
        remoteFactByContributor: remoteFact.fact_by_contributor,
        usernameByHash,
      })
      const finalIssueRaw = await applyServerText({
        abs,
        raw,
        parsed,
        serverTitle: String(updated.title ?? ''),
        serverBody: String(updated.description ?? ''),
        label: `задача ${hash}`,
      })
      upsertEntry(index, {
        entity_type: 'issue',
        entity_hash: hash,
        relative_path: entry.relative_path,
        remote_updated_at: toIso(updated._updated_at),
        remote_rev: updated.content_rev ?? undefined,
        content_etag_local: sha256Hex(finalIssueRaw),
      })
      await saveBaseSnapshot(ctx.root, 'issue', hash, finalIssueRaw)
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
      const storyData: Mutations.Capital.UpdateStory.IInput['data'] = {
        story_hash: hash,
        title: String(parsed.data.title ?? ''),
        description: parsed.body,
        content_format: parsed.data.content_format as Mutations.Capital.UpdateStory.IInput['data']['content_format'],
        status: parsed.data.status as Mutations.Capital.UpdateStory.IInput['data']['status'],
        sort_order: Number(parsed.data.sort_order ?? 0),
        base_rev: entry.remote_rev,
        origin: ORIGIN_CLI,
      }
      if (parsed.data.project_hash) {
        storyData.project_hash = String(parsed.data.project_hash)
      }
      if (parsed.data.issue_hash) {
        storyData.issue_hash = String(parsed.data.issue_hash)
      }
      let storyMutation: Mutations.Capital.UpdateStory.IOutput
      try {
        storyMutation = await ctx.client.Mutation(
          Mutations.Capital.UpdateStory.mutation,
          {
            variables: {
              data: storyData,
            },
          },
        )
      }
      catch (err) {
        const conflict = extractServerContentConflict(err)
        if (conflict) {
          await writeConflictAndFail({ root: ctx.root, abs, parsed, conflict, label: `требование ${hash}`, index, remaining })
        }
        throw err
      }
      const updated = storyMutation[Mutations.Capital.UpdateStory.name]
      if (updated == null) {
        throw new Error(`Не удалось обновить требование «${hash}» (пустой ответ мутации).`)
      }
      const finalStoryRaw = await applyServerText({
        abs,
        raw,
        parsed,
        serverTitle: String(updated.title ?? ''),
        serverBody: String(updated.description ?? ''),
        label: `требование ${hash}`,
      })
      upsertEntry(index, {
        entity_type: 'story',
        entity_hash: hash,
        relative_path: entry.relative_path,
        remote_updated_at: toIso(updated._updated_at),
        remote_rev: updated.content_rev ?? undefined,
        content_etag_local: sha256Hex(finalStoryRaw),
      })
      await saveBaseSnapshot(ctx.root, 'story', hash, finalStoryRaw)
    }

    remaining.delete(n)
  }

  await saveIndex(ctx.root, index)
  await saveStaging(ctx.root, { paths: [...remaining] })
  await writeWorkspaceIndexMarkdown(ctx.root)
}
