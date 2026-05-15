import { Mutations, Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'
import type {
  IDetailKUInput,
  IListMarketplaceKUInput,
  IMarketplaceKUDetails,
  ISetKUStatusInput,
} from '../model'

async function listKUDetails(data: IListMarketplaceKUInput): Promise<IMarketplaceKUDetails[]> {
  const { [Queries.Marketplace.ListKUDetails.name]: output } = await client.Query(
    Queries.Marketplace.ListKUDetails.query,
    { variables: { data } },
  )
  return (output ?? []) as IMarketplaceKUDetails[]
}

async function detailKU(data: IDetailKUInput): Promise<IMarketplaceKUDetails> {
  const { [Mutations.Marketplace.DetailKU.name]: output } = await client.Mutation(
    Mutations.Marketplace.DetailKU.mutation,
    { variables: { data } },
  )
  return output as IMarketplaceKUDetails
}

async function setKUStatus(data: ISetKUStatusInput): Promise<IMarketplaceKUDetails> {
  const { [Mutations.Marketplace.SetKUStatus.name]: output } = await client.Mutation(
    Mutations.Marketplace.SetKUStatus.mutation,
    { variables: { data } },
  )
  return output as IMarketplaceKUDetails
}

async function retryGeocode(coopname: string, coreBraname: string): Promise<IMarketplaceKUDetails> {
  const { [Mutations.Marketplace.RetryKUGeocode.name]: output } = await client.Mutation(
    Mutations.Marketplace.RetryKUGeocode.mutation,
    { variables: { coopname, coreBraname } },
  )
  return output as IMarketplaceKUDetails
}

export const api = {
  listKUDetails,
  detailKU,
  setKUStatus,
  retryGeocode,
}
