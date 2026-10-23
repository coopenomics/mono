import { t } from 'src/shared/i18n'

export const notEmpty = (val: any) => {
  return !!val || t('validation.required')
}
