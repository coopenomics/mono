/**
 * Реквизиты отчётов кооператива на стенде. Решение владельца 25.09.2026 —
 * произвольные значения: без ОКТМО XML 6-НДФЛ и уведомления не проходят схему
 * ФНС, и проверка отчётов снаружи была невозможна (C28-80). Заданные раньше
 * реквизиты не трогаются.
 */
import { tokenOf } from '../core/auth'
import { gql } from '../core/client'
import { CHAIRMAN } from '../core/roles'

const STAND_REQUISITES = {
  oktmo: '45382000',
  okved: '47.11',
  okpo: '12345678',
  okfs: '16',
  okopf: '20102',
  chairmanPosition: 'Председатель совета',
}

export async function ensureReportRequisites(): Promise<void> {
  const token = await tokenOf(CHAIRMAN)
  const d = await gql<any>(token, '{ getReportRequisites{ oktmo{ value } } }')
  if (d.getReportRequisites.oktmo.value)
    return
  await gql(token, 'mutation($i:UpdateReportRequisitesInput!){ updateReportRequisites(input:$i){ coopname } }', { i: STAND_REQUISITES })
}
