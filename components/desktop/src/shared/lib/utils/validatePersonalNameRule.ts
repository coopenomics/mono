import { t } from 'src/shared/i18n'

export const validatePersonalName = (val: any) => {
  return val === '' || /^[a-zA-Zа-яА-ЯёЁ\- ]*$/.test(val) || t('validation.personalName')
}
