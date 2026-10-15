import { Cooperative } from 'cooptypes'
import { Udata } from '../Models/Udata'
import type { MongoDBConnector } from '../Services/Databazor'

export interface EducationContractRef {
  contract_number: string
  contract_created_at: string
}

/**
 * Номер и дата договора УХД преподавателя по ЦПП «Образование». Документы
 * преподавателя — приложения к этому договору и называют его реквизиты;
 * бэкенд edubridge пишет их в Udata при подписании договора.
 */
export async function getEducationContractRef(
  storage: MongoDBConnector,
  data: { coopname: string, username: string, block_num?: number },
): Promise<EducationContractRef> {
  const udata = new Udata(storage)
  const [number, createdAt] = await Promise.all([
    udata.getOne({ coopname: data.coopname, username: data.username, key: Cooperative.Model.UdataKey.EDUCATION_CONTRACT_NUMBER, block_num: data.block_num }),
    udata.getOne({ coopname: data.coopname, username: data.username, key: Cooperative.Model.UdataKey.EDUCATION_CONTRACT_CREATED_AT, block_num: data.block_num }),
  ])
  if (!number?.value || !createdAt?.value)
    throw new Error('Номер и дата договора участия в хозяйственной деятельности преподавателя не найдены в Udata')

  return { contract_number: String(number.value), contract_created_at: String(createdAt.value) }
}
