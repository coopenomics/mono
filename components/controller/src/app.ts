import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import xss from 'xss-clean';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import cors from 'cors';
import config from './config/config';
import morgan from './config/morgan';
import { graphqlHttpBodyShouldSkipXss } from './config/graphql-xss-skip';

const app: Express = express();

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// Приложение стоит за nginx (receiver → внутренний nginx), а на контуре ещё и
// за L7, который затирает X-Forwarded-For адресом клиента. Без доверия к
// цепочке `req.ip` — адрес соседнего контейнера, и все лимиты «по IP»
// (вход, восстановление, ссылки из писем, регистрация) считают всех
// пользователей кооператива одним клиентом.
app.set('trust proxy', true);

// set security HTTP headers
app.use(helmet({ hsts: false }));

// parse json request body
// Лимит покрывает base64-загрузку изображений в GraphQL-мутациях (карточки
// Стола заказов до 8×10 МБ, фото гарантийного возврата до 10×10 МБ): base64
// раздувает бинарь в ~1.37×, поэтому ~160 МБ. nginx (playbooks) держит ту же
// планку client_max_body_size 160M.
app.use(
  express.json({
    limit: '160mb',
    // Подпись вебхука LiveKit покрывает хэш тела как оно пришло — сохраняем
    // его только для этого адреса, остальным запросам копия не нужна.
    verify: (req, _res, buf) => {
      if (req.url?.includes('/extensions/chatcoop/livekit-webhook')) {
        (req as typeof req & { rawBody?: string }).rawBody = buf.toString('utf8');
      }
    },
  })
);

// parse urlencoded request body
app.use(express.urlencoded({ extended: true, limit: '160mb' }));

// sanitize request data; для части GraphQL-мутаций см. GRAPHQL_ROOT_FIELDS_SKIP_XSS
// const xssMiddleware = xss();
// app.use((req: Request, res: Response, next: NextFunction) => {
//   if (graphqlHttpBodyShouldSkipXss(req)) {
//     return next();
//   }
//   return xssMiddleware(req, res, next);
// });
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

export default app;
