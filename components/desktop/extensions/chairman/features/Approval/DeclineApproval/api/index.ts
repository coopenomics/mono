// Вызовы одобрений живут в общем слое платформы: подписать одобрение можно и со
// стола, где процесс начался. Здесь — только то, чем пользуется стол председателя.
import { declineApproval } from 'src/features/ChairmanApproval';

export type { IDeclineApprovalInput, IDeclineApprovalOutput } from 'src/features/ChairmanApproval';

export const api = {
  declineApproval,
};
