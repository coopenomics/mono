import type { IBranch } from 'src/entities/Branch/model'

/** Человек участка в форме, в которой его отдаёт участок: председатель или доверенное лицо. */
export interface IBranchPerson {
  username: string
  first_name?: string
  last_name?: string
  middle_name?: string
}

/** Фамилия, имя и отчество; без данных — имя аккаунта. */
export function branchPersonName(p: IBranchPerson | null | undefined): string {
  if (!p) return ''
  const full = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(' ').trim()
  return full || p.username
}

/** Имена операторов участка по имени аккаунта: председатель и доверенные лица. */
export function branchPersonNames(branch: IBranch | null | undefined): Record<string, string> {
  if (!branch?.trustee) return {}
  const map: Record<string, string> = { [branch.trustee.username]: branchPersonName(branch.trustee) }
  for (const t of branch.trusted ?? []) map[t.username] = branchPersonName(t)
  return map
}
