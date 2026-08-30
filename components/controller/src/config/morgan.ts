import morgan from 'morgan';
import config from './config';
import logger from './logger';

// Переопределяем токен message для поддержки GraphQL ошибок
morgan.token('message', (req, res) => {
  // Сначала проверяем res.locals.errorMessage (установленное нашими фильтрами)
  if (res.locals.errorMessage) {
    return res.locals.errorMessage;
  }

  // Для GraphQL запросов пытаемся извлечь ошибки из тела ответа
  if (req.path === '/v1/graphql' && res.locals.graphQLErrors) {
    const errors = res.locals.graphQLErrors;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors[0].message || 'GraphQL Error';
    }
  }

  return '';
});

// Имя GraphQL-операции. Без него весь трафик рабочего стола выглядит в логе как
// однообразный поток `POST /v1/graphql`, и вопрос «кто именно долбит и что
// весит 200 КБ» по логам не решается.
//
// SDK шлёт запросы БЕЗ поля operationName (см. createThunder в
// @coopenomics/sdk — в теле только query и variables), а zeus генерирует
// анонимные операции вида `query{getAgenda{...}}`. Поэтому берём то, что
// реально идентифицирует запрос, — корневое поле выборки. operationName, если
// он всё же пришёл, имеет приоритет.
//
// Разбор регуляркой, а не парсером graphql: токен зовётся на каждый ответ, и
// платить за построение AST ради строки лога не стоит. Не распознали — «-».
const GQL_ROOT_FIELD =
  /^\s*(?:query|mutation|subscription)?\s*(?:[A-Za-z_]\w*)?\s*(?:\([^)]*\))?\s*\{\s*(?:[A-Za-z_]\w*\s*:\s*)?([A-Za-z_]\w*)/;

morgan.token('gql-operation', (req) => {
  const body = (req as unknown as { body?: unknown }).body;
  if (!body || typeof body !== 'object') return '-';

  const { operationName, query } = body as { operationName?: unknown; query?: unknown };
  if (typeof operationName === 'string' && operationName.length > 0) return operationName.slice(0, 64);
  if (typeof query !== 'string') return '-';

  return GQL_ROOT_FIELD.exec(query)?.[1]?.slice(0, 64) ?? '-';
});

// Новый токен для определения IP с проверкой нескольких заголовков
morgan.token('client-ip', (req) => {
  return req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
});

// Сквозной идентификатор запроса (C28-53). Его выдаёт L7-маршрутизатор и
// передаёт заголовком вниз по ярусам; каждый ярус пишет его в свою строку лога.
// До этого один запрос пайщика оставлял след в четырёх местах — access-лог L7,
// лог приёмника, лог внутреннего nginx узла и лог контроллера, — и связать их
// можно было только по времени и адресу, то есть на глаз. Теперь весь след
// собирается одним запросом в Loki: `|= "rid=<идентификатор>"`.
//
// Формат проверяется, а не берётся как есть. Nginx выдаёт ровно 32
// шестнадцатеричных знака, и всё, что на это не похоже, — либо обращение мимо
// яруса (локальная разработка, запрос изнутри docker-сети), либо чужая
// подстановка. Незнакомое значение в строку лога пускать нельзя: с переводом
// строки внутри оно дописало бы в журнал что угодно.
const RID = /^[0-9a-f]{32}$/i;

morgan.token('request-id', (req) => {
  const header = req.headers['x-request-id'];
  return typeof header === 'string' && RID.test(header) ? header : '-';
});

// Форматы с использованием нового токена 'client-ip'
const getIpFormat = () => (config.env === 'production' ? ':client-ip - ' : ':remote-addr - ');
// Операция дописывается В КОНЕЦ строки, а не в середину: у Loki/promtail разбор
// идёт по началу строки, и вставка поля посередине сломала бы существующие
// запросы к логам.
const successResponseFormat = `${getIpFormat()}:method :url :status - :response-time ms - op: :gql-operation rid=:request-id`;
const errorResponseFormat = `${getIpFormat()}:method :url :status - :response-time ms - message: :message - op: :gql-operation rid=:request-id`;

const successHandler = morgan(successResponseFormat, {
  skip: (req, res) => res.statusCode >= 400,
  stream: { write: (message) => logger.debug(message.trim()) },
});

const errorHandler = morgan(errorResponseFormat, {
  skip: (req, res) => res.statusCode < 400,
  stream: { write: (message) => logger.error(message.trim()) },
});

export default {
  successHandler,
  errorHandler,
};
