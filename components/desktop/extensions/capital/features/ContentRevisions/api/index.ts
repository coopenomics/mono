import { client } from 'src/shared/api/client'
import { Mutations, Queries } from '@coopenomics/sdk'

export type IContentEntityType = Queries.Capital.GetContentRevisions.IInput['data']['entity_type']
export type IContentRevisionSummary =
  Queries.Capital.GetContentRevisions.IOutput[typeof Queries.Capital.GetContentRevisions.name][number]
export type IContentRevision = NonNullable<
  Queries.Capital.GetContentRevision.IOutput[typeof Queries.Capital.GetContentRevision.name]
>

async function getRevisions(entity_type: IContentEntityType, entity_hash: string): Promise<IContentRevisionSummary[]> {
  const { [Queries.Capital.GetContentRevisions.name]: result } = await client.Query(
    Queries.Capital.GetContentRevisions.query,
    { variables: { data: { entity_type, entity_hash } } },
  )
  return result
}

async function getRevision(
  entity_type: IContentEntityType,
  entity_hash: string,
  rev: number,
): Promise<IContentRevision | null> {
  const { [Queries.Capital.GetContentRevision.name]: result } = await client.Query(
    Queries.Capital.GetContentRevision.query,
    { variables: { data: { entity_type, entity_hash, rev } } },
  )
  return result ?? null
}

async function restoreRevision(
  entity_type: IContentEntityType,
  entity_hash: string,
  rev: number,
  base_rev: number,
): Promise<IContentRevisionSummary> {
  const { [Mutations.Capital.RestoreContentRevision.name]: result } = await client.Mutation(
    Mutations.Capital.RestoreContentRevision.mutation,
    { variables: { data: { entity_type, entity_hash, rev, base_rev } } },
  )
  return result
}

export const api = { getRevisions, getRevision, restoreRevision }
