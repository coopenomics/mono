import emailRegex from 'email-regex';
import { t } from 'src/shared/i18n';
const emailValidator = emailRegex({ exact: true });

export function validEmail(email: string) {
  return emailValidator.test(email) || t('validation.email')
}
