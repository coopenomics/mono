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

// set security HTTP headers
app.use(helmet({ hsts: false }));

// parse json request body
// Лимит покрывает base64-загрузку изображений в GraphQL-мутациях (карточки
// Стола заказов до 8×10 МБ, фото гарантийного возврата до 10×10 МБ): base64
// раздувает бинарь в ~1.37×, поэтому ~160 МБ. nginx (playbooks) держит ту же
// планку client_max_body_size 160M.
app.use(express.json({ limit: '160mb' }));

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
