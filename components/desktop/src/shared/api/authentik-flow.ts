/**
 * Исполнитель потоков authentik для CoopID (задача 105-30).
 *
 * Экраны входа, согласия и кода рисует сам стол, а authentik остаётся исполнителем:
 * стол спрашивает у него текущий шаг, показывает его своими компонентами и возвращает
 * ответ. Так же устроен родной интерфейс authentik, так что это штатная дорога, а не обход.
 * Подход перенесён из карты пайщика (card.coop, ADR-0003).
 *
 * @packageDocumentation
 */

/** Шаги, которые стол рисует сам. Значения — имена стадий authentik. */
export enum FlowStage {
  Identification = 'ak-stage-identification',
  Password = 'ak-stage-password',
  Prompt = 'ak-stage-prompt',
  Email = 'ak-stage-email',
  AuthenticatorEmail = 'ak-stage-authenticator-email',
  AuthenticatorValidate = 'ak-stage-authenticator-validate',
  Consent = 'ak-stage-consent',
  Autosubmit = 'ak-stage-autosubmit',
  SessionEnd = 'ak-stage-session-end',
  UserLogin = 'ak-stage-user-login',
  Redirect = 'xak-flow-redirect',
  Denied = 'ak-stage-access-denied',
  Failed = 'ak-stage-flow-error',
}

/** Поле формы, как его описывает authentik. */
export interface FlowField {
  field_key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder: string;
  initial_value: string;
  order: number;
  sub_text: string;
  choices: string[] | null;
}

export interface FlowFieldError {
  string: string;
  code: string;
}

/** Способ входа со стороны: в `challenge` лежит готовый следующий шаг. */
export interface FlowSource {
  name: string;
  challenge: FlowChallenge;
  icon_url?: string | null;
  promoted?: boolean;
}

/** Устройство проверки кода. */
export interface FlowDeviceChallenge {
  device_class: string;
  device_uid: string;
  challenge: Record<string, unknown>;
  last_used?: string | null;
}

/** Текущий шаг потока. Набор полей зависит от стадии. */
export interface FlowChallenge {
  component: string;
  flow_info?: { title?: string; layout?: string; cancel_url?: string };
  response_errors?: Record<string, FlowFieldError[]>;
  user_fields?: string[] | null;
  password_fields?: boolean;
  enroll_url?: string | null;
  recovery_url?: string | null;
  sources?: FlowSource[];
  primary_action?: string;
  permissions?: { name: string; id: string }[];
  token?: string;
  url?: string;
  attrs?: Record<string, string>;
  application_name?: string;
  application_launch_url?: string | null;
  fields?: FlowField[];
  email?: string;
  email_required?: boolean;
  device_challenges?: FlowDeviceChallenge[];
  pending_user?: string;
  pending_user_avatar?: string;
  to?: string;
  error_message?: string;
  title?: string;
}

export type FlowAnswer = Record<string, unknown>;

/** Разговор с исполнителем не состоялся: сеть, отказ прокси, неожиданный ответ. */
export class FlowUnavailable extends Error {}

const CSRF_COOKIE = 'authentik_csrf';
const CSRF_HEADER = 'X-authentik-CSRF';

const cookie = (name: string): string => {
  const found = document.cookie.split('; ').find((pair) => pair.startsWith(`${name}=`));
  return found ? decodeURIComponent(found.slice(name.length + 1)) : '';
};

/**
 * Адрес исполнителя. Строка запроса потока едет параметром `query`: в ней `next` и токены
 * из писем, без неё поток не знает, куда вести человека в конце.
 */
const stepUrl = (base: string, slug: string, query: string): string =>
  `${base.replace(/\/$/, '')}/api/v3/flows/executor/${encodeURIComponent(slug)}/?query=${encodeURIComponent(query)}`;

/**
 * Спрашивает текущий шаг или отвечает на него.
 *
 * Принятый ответ исполнитель подтверждает не телом, а перенаправлением на самого себя,
 * поэтому `redirect: 'follow'` обязателен. Прочь со своего адреса он по HTTP не уводит:
 * адрес завершения приходит внутри JSON шагом `xak-flow-redirect`.
 */
export const executeFlow = async (
  base: string,
  slug: string,
  query: string,
  answer?: FlowAnswer,
): Promise<FlowChallenge> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (answer) {
    headers['Content-Type'] = 'application/json';
    headers[CSRF_HEADER] = cookie(CSRF_COOKIE);
  }
  const request: RequestInit = {
    method: answer ? 'POST' : 'GET',
    credentials: 'include',
    headers,
    redirect: 'follow',
  };
  if (answer) request.body = JSON.stringify(answer);

  let response: Response;
  try {
    response = await fetch(stepUrl(base, slug, query), request);
  } catch {
    throw new FlowUnavailable('Сервер входа недоступен. Попробуйте ещё раз через минуту.');
  }
  if (!response.ok) {
    throw new FlowUnavailable(`Сервер входа ответил ошибкой ${response.status}. Попробуйте ещё раз.`);
  }
  try {
    return (await response.json()) as FlowChallenge;
  } catch {
    throw new FlowUnavailable('Сервер входа ответил неожиданно. Попробуйте ещё раз.');
  }
};

/** Служебные «ошибки»: письмо отправлено, устройство выбрано — человеку показывать нечего. */
const SILENT_CODES: ReadonlySet<string> = new Set(['email-sent']);
const SILENT_STRINGS: ReadonlySet<string> = new Set(['Empty response']);

/** Первая ошибка формы целиком. */
export const formError = (challenge: FlowChallenge): string | null => {
  const first = challenge.response_errors?.['non_field_errors']?.[0];
  if (!first || SILENT_CODES.has(first.code) || SILENT_STRINGS.has(first.string)) return null;
  return first.string;
};

/** Первая ошибка конкретного поля. */
export const fieldError = (challenge: FlowChallenge, field: string): string | undefined =>
  challenge.response_errors?.[field]?.[0]?.string;

/** Есть ли у человека живая сессия authentik (по куке; отказ — это ответ, не ошибка). */
export const hasIdpSession = async (base = ''): Promise<boolean> => {
  try {
    const response = await fetch(`${base}/api/v3/core/users/me/`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
};
