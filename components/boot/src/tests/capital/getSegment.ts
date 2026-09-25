import { CapitalContract } from 'cooptypes'
import type Blockchain from '../../blockchain'
import { makeCombinedChecksum256NameIndexKey } from '../shared/combinedKeys'

export async function getSegment(blockchain: Blockchain, coopname: string, project_hash: string, author: string): Promise<CapitalContract.Tables.Segments.ISegment> {
  const key = makeCombinedChecksum256NameIndexKey(project_hash, author)
  const rows = (await blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    CapitalContract.Tables.Segments.tableName,
    1000,
    key,
    key,
    3,
    'i128',
  ))

  return rows[0]
}

/** Все сегменты проекта — по индексу byproject. */
export async function getProjectSegments(blockchain: Blockchain, coopname: string, project_hash: string): Promise<CapitalContract.Tables.Segments.ISegment[]> {
  return blockchain.getTableRows(
    CapitalContract.contractName.production,
    coopname,
    CapitalContract.Tables.Segments.tableName,
    1000,
    project_hash,
    project_hash,
    2,
    'sha256',
  )
}
