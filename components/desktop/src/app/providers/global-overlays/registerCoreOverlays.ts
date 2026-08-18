import { registerGlobalOverlay } from 'src/shared/lib/overlays';
import { RequireAgreements } from 'src/widgets/RequireAgreements';
import { SelectBranchOverlay } from 'src/features/Branch/SelectBranch';
import { NotificationPermissionDialog } from 'src/features/NotificationPermissionDialog';
import { ExitOverlay } from 'src/features/Membership/ExitFromCoop';
import { PinPrompt } from 'src/features/Security/PinPrompt';
import { NodeSyncOverlay } from 'src/entities/System/ui/NodeSyncOverlay';

/**
 * Регистрация ПЛАТФОРМЕННЫХ глобальных оверлеев в универсальный реестр.
 *
 * Это единственное место, где app-слой знает о конкретных платформенных
 * оверлеях; App-шелл их уже не импортирует — рендерит реестр обобщённо.
 * Оверлеи РАСШИРЕНИЙ регистрируются в их `install.ts`, не здесь.
 */
let registered = false;

export function registerCoreOverlays(): void {
  if (registered) return;
  registered = true;
  registerGlobalOverlay('core:require-agreements', RequireAgreements);
  registerGlobalOverlay('core:select-branch', SelectBranchOverlay);
  registerGlobalOverlay('core:notification-permission', NotificationPermissionDialog);
  registerGlobalOverlay('core:exit-overlay', ExitOverlay);
  // CoopID: запрос PIN при подписи после простоя и после перезагрузки.
  registerGlobalOverlay('core:pin-prompt', PinPrompt);
  registerGlobalOverlay('core:node-sync-overlay', NodeSyncOverlay);
}
