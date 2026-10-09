import { Zeus } from '@coopenomics/sdk';
import { useSessionStore } from 'src/entities/Session';
import type { ILearnerInput } from '../../../entities/Learner';

/**
 * Пайщик как обучающийся: имя и почта берутся из его учётной записи, вводить
 * нечего. Почты в учётной записи нет — `null`: контакт пайщик укажет в форме.
 */
export function selfLearnerInput(): ILearnerInput | null {
  const session = useSessionStore();
  const email = session.providerAccount?.email ?? '';
  if (!email) return null;
  return { display_name: session.displayName, recipient_type: Zeus.EduRecipientType.EMAIL, recipient_value: email, is_self: true };
}
