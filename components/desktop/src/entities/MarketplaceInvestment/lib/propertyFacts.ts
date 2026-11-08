import type { IDocumentAggregate, IDocumentPackageAggregate } from 'src/entities/Document/model/types'

/**
 * Сведения о принятом имуществе для истории паевых взносов. После приёма
 * заявление стирается из цепи, а описание имущества остаётся в документах его
 * пакета: заявление 1120, протокол 1121 и акт 1122 несут одни и те же поля
 * (наименование, описание, количество, участок, председатель участка). Берём
 * первое найденное значение каждого поля.
 */
export interface InvestPropertyFacts {
  name?: string
  description?: string
  quantity?: string
  unit?: string
  branchName?: string
  chairmanName?: string
}

function metaOf(agg: IDocumentAggregate | null | undefined): Record<string, unknown> {
  const raw = (agg?.document?.meta ?? agg?.rawDocument?.meta) as unknown
  if (!raw) return {}
  if (typeof raw === 'object') return raw as Record<string, unknown>
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>
  } catch {
    return {}
  }
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)

export function propertyFactsOf(pkg: IDocumentPackageAggregate | null | undefined): InvestPropertyFacts | null {
  if (!pkg) return null
  const aggregates = [
    pkg.statement?.documentAggregate,
    ...(pkg.acts ?? []).map((a) => a.documentAggregate),
    pkg.decision?.documentAggregate,
    ...(pkg.links ?? []),
  ]
  const facts: InvestPropertyFacts = {}
  for (const agg of aggregates) {
    const m = metaOf(agg)
    facts.name ??= text(m.property_name)
    facts.description ??= text(m.property_description)
    facts.quantity ??= text(m.property_quantity)
    facts.unit ??= text(m.property_unit)
    facts.branchName ??= text(m.branch_name)
    facts.chairmanName ??= text(m.branch_chairman_name)
  }
  return facts.name ? facts : null
}
