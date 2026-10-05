/**
 * Подключение пайщика к Столу заказов — шаги, которыми его проводит рабочий
 * стол (страница OnboardingMemberPickCpp): оферта программы и пункт выдачи.
 */
import crypto from 'node:crypto'
import type { Who } from '../core'
import { COOP, gql, signDocument, tokenOf } from '../core'

/** Шаблон инстанса оферты ЦПП «Стол заказов» (cooptypes 1102.MarketplaceOffer). */
export const OFFER_REGISTRY_ID = 1102

/** Инстанс оферты так, как его собирает стол пайщика. */
export async function generateOffer(token: string, username: string): Promise<any> {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = await gql<any>(token, `mutation($i:GenerateAnyDocumentInput!){
    generateDocument(input:$i){ full_title html hash meta binary }
  }`, {
    i: {
      data: {
        registry_id: OFFER_REGISTRY_ID,
        coopname: COOP,
        username,
        marketplace_agreement_number: crypto.randomBytes(8).toString('hex').toUpperCase(),
        marketplace_agreement_created_at: `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`,
      },
    },
  })
  return d.generateDocument
}

/** Пайщик подписывает оферту программы. */
export async function signOffer(who: Who): Promise<void> {
  const token = await tokenOf(who)
  const signed = await signDocument(who.wif, await generateOffer(token, who.account), who.account, 1)
  await gql(token, `mutation($i:MarketplaceSignOnboardingOfferInput!){
    marketplaceSignOnboardingOffer(input:$i){ source }
  }`, { i: { document: signed } })
}

/** Пайщик выбирает пункт выдачи. */
export async function chooseDeliveryPoint(who: Who, braname: string): Promise<void> {
  await gql(await tokenOf(who), `mutation($i:MarketplaceSetCartDeliveryPointInput!){
    marketplaceSetCartDeliveryPoint(input:$i){ delivery_braname }
  }`, { i: { delivery_braname: braname } })
}

/** Подключение целиком: после него пайщику открыты права заказчика. */
export async function onboardOrderer(who: Who, braname: string): Promise<void> {
  await signOffer(who)
  await chooseDeliveryPoint(who, braname)
}
