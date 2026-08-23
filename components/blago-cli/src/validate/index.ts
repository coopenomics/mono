// Минимальные проверки полей перед push.

import type { EntityFrontmatterType, ParsedBlagoFile } from '../format/index.js'
import { parseFactHoursFromFrontmatter } from '../format/index.js'

export class BlagoValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BlagoValidationError'
  }
}

function reqString(data: Record<string, unknown>, key: string, entity: string): string {
  const v = data[key]
  if (v === undefined || v === null || String(v).trim() === '') {
    throw new BlagoValidationError(`${entity}: отсутствует или пустое поле frontmatter «${key}»`)
  }
  return String(v)
}

function optStringArray(data: Record<string, unknown>, key: string, entity: string): string[] {
  const v = data[key]
  if (v === undefined || v === null) {
    return []
  }
  if (!Array.isArray(v)) {
    throw new BlagoValidationError(`${entity}: поле «${key}» должно быть массивом строк`)
  }
  return v.map(x => String(x))
}

export function validateParsedForPush(parsed: ParsedBlagoFile): {
  type: EntityFrontmatterType
  hash: string
} {
  const { type, data } = parsed
  if (type === 'project') {
    reqString(data, 'title', 'project')
    const hash = reqString(data, 'hash', 'project')
    reqString(data, 'coopname', 'project')
    return { type, hash }
  }
  if (type === 'issue') {
    reqString(data, 'title', 'issue')
    const hash = reqString(data, 'hash', 'issue')
    reqString(data, 'project_hash', 'issue')
    reqString(data, 'status', 'issue')
    reqString(data, 'priority', 'issue')
    if (data.estimate === undefined || data.estimate === null || Number.isNaN(Number(data.estimate))) {
      throw new BlagoValidationError('issue: поле «estimate» должно быть числом')
    }
    optStringArray(data, 'creators', 'issue')
    optStringArray(data, 'labels', 'issue')
    if ('fact_hours' in data && data.fact_hours !== undefined && data.fact_hours !== null) {
      try {
        parseFactHoursFromFrontmatter(data)
      }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        throw new BlagoValidationError(`issue: ${msg}`)
      }
    }
    if (data.created_by !== undefined && data.created_by !== null && typeof data.created_by !== 'string') {
      throw new BlagoValidationError('issue: поле created_by должно быть строкой')
    }
    return { type, hash }
  }
  if (type === 'story') {
    reqString(data, 'title', 'story')
    const hash = reqString(data, 'hash', 'story')
    reqString(data, 'content_format', 'story')
    reqString(data, 'status', 'story')
    if (data.created_by !== undefined && data.created_by !== null && typeof data.created_by !== 'string') {
      throw new BlagoValidationError('story: поле created_by должно быть строкой')
    }
    if (!data.project_hash && !data.issue_hash) {
      throw new BlagoValidationError('story: нужен project_hash и/или issue_hash')
    }
    return { type, hash }
  }
  throw new BlagoValidationError(`Неизвестный тип сущности: ${type}`)
}
