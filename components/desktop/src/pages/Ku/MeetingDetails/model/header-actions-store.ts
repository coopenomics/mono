import { ref } from 'vue';

/**
 * Мост между страницей собрания и кнопками действий в шапке (useHeaderActions):
 * компонент шапки рендерится вне поддерева страницы, поэтому состояние
 * и колбэки передаются через module-level ref, а не через props.
 */
export interface KuMeetingHeaderActionsState {
  canJoin: boolean;
  canStart: boolean;
  hasQuorum: boolean;
  canClose: boolean;
  canExec: boolean;
  canCancel: boolean;
  busy: boolean;
  onJoin: () => void;
  onStartOpen: () => void;
  onClose: () => void;
  onExec: () => void;
  onCancelOpen: () => void;
}

export const kuMeetingHeaderActions = ref<KuMeetingHeaderActionsState | null>(null);
