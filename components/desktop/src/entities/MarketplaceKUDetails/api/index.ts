import { rawGraphQL } from './raw-graphql'
import type {
  IDetailKUInput,
  IListMarketplaceKUInput,
  IMarketplaceKUDetails,
  ISetKUStatusInput,
} from '../model'

const KU_DETAILS_FIELDS = `
  coopname
  coreBraname
  addressFull
  contactPhone
  contactEmail
  workingHours {
    mon { open close breaks { start end } }
    tue { open close breaks { start end } }
    wed { open close breaks { start end } }
    thu { open close breaks { start end } }
    fri { open close breaks { start end } }
    sat { open close breaks { start end } }
    sun { open close breaks { start end } }
  }
  description
  status
  lat
  lng
  geocodeStatus
  geocodeErrorMessage
  geocodedAt
  createdAt
  updatedAt
`

async function listKUDetails(data: IListMarketplaceKUInput): Promise<IMarketplaceKUDetails[]> {
  const query = `
    query MarketplaceListKUDetails($data: ListMarketplaceKUInput!) {
      marketplaceListKUDetails(data: $data) { ${KU_DETAILS_FIELDS} }
    }
  `
  const result = await rawGraphQL<{ marketplaceListKUDetails: IMarketplaceKUDetails[] }>(query, { data })
  return result.marketplaceListKUDetails
}

async function detailKU(data: IDetailKUInput): Promise<IMarketplaceKUDetails> {
  const query = `
    mutation MarketplaceDetailKU($data: MarketplaceDetailKUInput!) {
      marketplaceDetailKU(data: $data) { ${KU_DETAILS_FIELDS} }
    }
  `
  const result = await rawGraphQL<{ marketplaceDetailKU: IMarketplaceKUDetails }>(query, { data })
  return result.marketplaceDetailKU
}

async function setKUStatus(data: ISetKUStatusInput): Promise<IMarketplaceKUDetails> {
  const query = `
    mutation MarketplaceSetKUStatus($data: MarketplaceSetKUStatusInput!) {
      marketplaceSetKUStatus(data: $data) { ${KU_DETAILS_FIELDS} }
    }
  `
  const result = await rawGraphQL<{ marketplaceSetKUStatus: IMarketplaceKUDetails }>(query, { data })
  return result.marketplaceSetKUStatus
}

async function retryGeocode(coopname: string, coreBraname: string): Promise<IMarketplaceKUDetails> {
  const query = `
    mutation MarketplaceRetryKUGeocode($coopname: String!, $coreBraname: String!) {
      marketplaceRetryKUGeocode(coopname: $coopname, coreBraname: $coreBraname) { ${KU_DETAILS_FIELDS} }
    }
  `
  const result = await rawGraphQL<{ marketplaceRetryKUGeocode: IMarketplaceKUDetails }>(query, {
    coopname,
    coreBraname,
  })
  return result.marketplaceRetryKUGeocode
}

export const api = {
  listKUDetails,
  detailKU,
  setKUStatus,
  retryGeocode,
}
