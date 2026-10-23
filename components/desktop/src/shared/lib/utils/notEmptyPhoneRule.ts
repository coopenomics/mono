import { t } from 'src/shared/i18n'

export const notEmptyPhone = (val: any) => {
  return val != '+7 (___) ___-__-__' || t('validation.required')
}
