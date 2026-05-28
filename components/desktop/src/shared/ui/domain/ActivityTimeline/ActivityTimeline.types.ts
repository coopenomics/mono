export type ActivityEventType =
  | 'create'
  | 'update'
  | 'sign'
  | 'reject'
  | 'comment'
  | 'system'
  | 'transfer';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  icon?: string;
  title: string;
  description?: string;
  actor?: string;
  date: string;
}

export interface ActivityTimelineProps {
  events: ActivityEvent[];
  groupByDate?: boolean;
}
