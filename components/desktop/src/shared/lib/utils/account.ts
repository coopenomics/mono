import {
  AccountTypes,
  type IAccount,
} from 'src/entities/Account/types'
import { t } from 'src/shared/i18n';

/**
 * Функция для получения отформатированного имени участника
 * @param account - объект аккаунта пользователя
 * @returns форматированное имя/наименование
 */
export const getName = (account: IAccount) => {
  const d = account.private_account
  if (!d) return ''
  switch (d.type) {
    case AccountTypes.individual:
      return `${d.individual_data?.last_name} ${d.individual_data?.first_name} ${d.individual_data?.middle_name}`
    case AccountTypes.entrepreneur:
      return t('utils.account.entrepreneurFullName', { lastName: d.entrepreneur_data?.last_name, firstName: d.entrepreneur_data?.first_name, middleName: d.entrepreneur_data?.middle_name })
    case AccountTypes.organization:
      return d.organization_data?.short_name
    default:
      return ''
  }
}
