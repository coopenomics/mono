// Вызовы одобрений живут в общем слое платформы: подписать одобрение можно и со
// стола, где процесс начался. Здесь — только то, чем пользуется стол председателя.
import { confirmApproval } from 'src/features/ChairmanApproval';

export type { IConfirmApprovalInput, IConfirmApprovalOutput } from 'src/features/ChairmanApproval';

export const api = {
  confirmApproval,
};
