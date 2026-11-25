import type { IMetaDocument } from '@coopenomics/docs-templates';
import type { IAgenda } from 'src/entities/Agenda/model';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { t } from 'src/shared/i18n';
import { decisionFactory } from 'src/shared/lib/decision-factory';

/** Имя маршрута отдельной страницы вопроса повестки. */
export const AGENDA_QUESTION_ROUTE = 'agenda-question';

/** Заголовок из метаданных заявления в таблице решений: объект либо строка JSON. */
function titleFromTableMeta(meta: unknown): string | null {
  if (!meta) return null;
  if (typeof meta === 'object') return (meta as { title?: string }).title || null;
  try {
    return (JSON.parse(String(meta)) as { title?: string })?.title || null;
  } catch {
    return null;
  }
}

/**
 * Заголовок вопроса: название заявления из пакета документов, иначе из таблицы
 * решений. Уточнение от приложения (например, цель расходов служебной записки)
 * встаёт в скобках — иначе вопросы одного типа в повестке не различить.
 */
export function questionTitleOf(agenda: IAgenda): string {
  const meta = agenda.documents?.statement?.documentAggregate?.rawDocument?.meta as IMetaDocument | undefined;
  const title = meta?.title || titleFromTableMeta(agenda.table?.statement?.meta) || t('questions.questionCard.untitledQuestion');
  const type = agenda.table?.type;
  const detail = type ? decisionFactory.getTitleDetail(type, agenda) : null;
  return detail ? `${title} (${detail})` : title;
}

/** Заявитель: фамилия с инициалами по сертификату, иначе учётное имя. */
export function applicantNameOf(agenda: IAgenda): string {
  const certificate = agenda.table.username_certificate;
  if (certificate) return getShortNameFromCertificate(certificate);
  return t('questions.questionCard.accountFallback', { username: agenda.table.username });
}

/**
 * Отрицательный консенсус: против проголосовало большинство состава совета.
 * Порог зеркален контракту (votefor/declinedec): против*100 > состав*50, строго.
 * Состав совета приходит в решении с сервера.
 */
export function isQuestionRejected(agenda: IAgenda): boolean {
  const table = agenda.table as { votes_against?: string[]; council_members_count?: number };
  const against = table.votes_against?.length ?? 0;
  const members = table.council_members_count ?? 0;
  return members > 0 && against * 100 > members * 50;
}
