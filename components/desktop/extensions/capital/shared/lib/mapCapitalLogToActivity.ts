import type { ActivityEvent, ActivityEventType } from 'src/shared/ui/domain/ActivityTimeline';

/**
 * Значения LogEventType с бэкенда (Nest registerEnumType → lowercase enum value).
 * Zeus-enum в UPPER_CASE с ними не совпадает — маппим по строкам API.
 */
type CapitalLogLike = {
  _id: string;
  event_type?: string | null;
  title?: string | null;
  description?: string | null;
  actor_name?: string | null;
  initiator?: string | null;
  message?: string | null;
  created_at: string | Date;
};

function normalizeEventType(eventType?: string | null): string {
  return (eventType || '').toLowerCase();
}

export function mapCapitalLogEventType(eventType?: string | null): ActivityEventType {
  switch (normalizeEventType(eventType)) {
    case 'project_created':
    case 'component_created':
    case 'issue_created':
    case 'story_created':
    case 'cycle_created':
    case 'contributor_registered':
    case 'contributor_imported':
    case 'contributor_joined':
      return 'create';
    case 'project_edited':
    case 'issue_updated':
    case 'story_updated':
    case 'contributor_edited':
    case 'project_plan_set':
    case 'segment_refreshed':
    case 'project_refreshed':
    case 'program_refreshed':
      return 'update';
    case 'investment_received':
    case 'program_investment_received':
    case 'funds_allocated':
    case 'funds_deallocated':
    case 'project_property_received':
    case 'program_property_received':
    case 'segment_converted':
    case 'project_withdrawal':
    case 'program_withdrawal':
    case 'result_contribution_received':
    case 'expense_created':
    case 'expenses_expanded':
    case 'debt_created':
    case 'project_funded':
    case 'program_funded':
      return 'transfer';
    case 'vote_submitted':
    case 'result_pushed':
    case 'voting_completed':
    case 'commit_received':
      return 'sign';
    case 'project_stopped':
    case 'project_deleted':
    case 'issue_deleted':
    case 'story_deleted':
      return 'reject';
    default:
      return 'system';
  }
}

const ICON_BY_EVENT: Record<string, string> = {
  project_created: 'create_new_folder',
  project_edited: 'edit',
  project_started: 'play_arrow',
  project_stopped: 'stop',
  project_closed: 'lock',
  project_opened: 'lock_open',
  project_deleted: 'delete',
  component_created: 'folder_copy',
  contributor_joined: 'person_add',
  contributor_registered: 'person_add',
  contributor_imported: 'upload_file',
  investment_received: 'eco',
  program_investment_received: 'eco',
  commit_received: 'commit',
  issue_created: 'task_alt',
  issue_updated: 'edit_note',
  issue_deleted: 'delete_outline',
  story_created: 'description',
  story_updated: 'edit_document',
  voting_started: 'how_to_vote',
  vote_submitted: 'how_to_vote',
  voting_completed: 'done_all',
  result_pushed: 'assignment_turned_in',
  segment_converted: 'donut_large',
  project_master_assigned: 'admin_panel_settings',
  author_added: 'group_add',
  funds_allocated: 'move_up',
  funds_deallocated: 'move_down',
  project_property_received: 'inventory_2',
  program_property_received: 'inventory_2',
  project_withdrawal: 'undo',
  program_withdrawal: 'undo',
  expense_created: 'receipt_long',
  expenses_expanded: 'receipt_long',
  debt_created: 'credit_card',
  project_funded: 'eco',
  program_funded: 'eco',
  result_contribution_received: 'eco',
};

export function mapCapitalLogIcon(eventType?: string | null): string {
  return ICON_BY_EVENT[normalizeEventType(eventType)] || 'history';
}

export function mapCapitalLogToActivity(log: CapitalLogLike): ActivityEvent {
  const date =
    typeof log.created_at === 'string' ? log.created_at : new Date(log.created_at).toISOString();

  const initiator = (log.initiator || '').trim();
  let title = (log.title || '').trim();
  let description = (log.description || '').trim() || undefined;
  let actorName = (log.actor_name || '').trim();

  // Пока SDK/query без title — разбираем legacy message «ФИО — действие. детали»
  if (!title && log.message) {
    const parsed = parseLegacyMessage(log.message);
    title = parsed.title;
    description = description || parsed.description;
    actorName = actorName || parsed.actor || '';
  }

  const actor =
    actorName && (!initiator || actorName.toLowerCase() !== initiator.toLowerCase())
      ? actorName
      : undefined;

  return {
    id: log._id,
    type: mapCapitalLogEventType(log.event_type),
    icon: mapCapitalLogIcon(log.event_type),
    title: title || 'Событие',
    description,
    actor,
    date,
  };
}

/** «ФИО — Заголовок. детали» или «ФИО — Заголовок» */
function parseLegacyMessage(message: string): {
  title: string;
  description?: string;
  actor?: string;
} {
  const trimmed = message.trim();
  const sep = trimmed.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (!sep) return { title: trimmed };

  const actor = sep[1].trim();
  const rest = sep[2].trim();
  const dot = rest.indexOf('. ');
  if (dot > 0) {
    return {
      actor,
      title: rest.slice(0, dot).trim(),
      description: rest.slice(dot + 2).trim(),
    };
  }
  return { actor, title: rest };
}
