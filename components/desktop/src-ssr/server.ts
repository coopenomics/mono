/**
 * More info about this file:
 * https://v2.quasar.dev/quasar-cli-vite/developing-ssr/ssr-webserver
 *
 * Runs in Node context.
 */

import { Server } from 'node:http';
import compression from 'compression';
import express, { Application, Request, Response } from 'express';
import {
  defineSsrCreate,
  defineSsrInjectDevMiddleware,
  defineSsrListen,
  defineSsrClose,
  defineSsrServeStaticContent,
  defineSsrRenderPreloadTag,
} from '#q-app/wrappers';

declare module '#q-app' {
  interface SsrDriver {
    app: Application;
    listenResult: Server;
    request: Request;
    response: Response;
  }
}

export const create = defineSsrCreate(() => {
  const app = express();

  app.disable('x-powered-by');

  if (process.env.PROD) {
    app.use(compression());
  }

  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  return app;
});

export const injectDevMiddleware = defineSsrInjectDevMiddleware(({ app }) => {
  return (middleware) => {
    app.use(middleware);
  };
});

export const listen = defineSsrListen(({ app, devHttpsApp, port }) => {
  const server = devHttpsApp || app;
  return server.listen(port, () => {
    if (process.env.PROD) {
      console.log('Server listening at port ' + port);
    }
  });
});

export const close = defineSsrClose(({ listenResult }) => {
  return listenResult.close();
});

const maxAge = process.env.DEV ? 0 : 1000 * 60 * 60 * 24 * 30;

// Файлы без хеша в имени: кэш ломает обновление PWA/shell.
const NO_CACHE_STATIC =
  /(?:^|\/)(service-worker\.js|offline\.html|push-sw\.js|manifest\.webmanifest|manifest\.json)$/i;

type StaticOpts = {
  setHeaders?: (res: Response, filePath: string, stat: unknown) => void;
  [key: string]: unknown;
};

export const serveStaticContent = defineSsrServeStaticContent(({ app, resolve }) => {
  return ({ urlPath = '/', pathToServe = '.', opts = {} }) => {
    const userOpts = opts as StaticOpts;
    const serveFn = express.static(resolve.public(pathToServe), {
      maxAge,
      ...userOpts,
      setHeaders(res, filePath, stat) {
        userOpts.setHeaders?.(res, filePath, stat);
        if (NO_CACHE_STATIC.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    });
    app.use(resolve.urlPath(urlPath), serveFn);
  };
});

const jsRE = /\.js$/;
const cssRE = /\.css$/;
const woffRE = /\.woff$/;
const woff2RE = /\.woff2$/;
const gifRE = /\.gif$/;
const jpgRE = /\.jpe?g$/;
const pngRE = /\.png$/;

export const renderPreloadTag = defineSsrRenderPreloadTag((file) => {
  if (jsRE.test(file) === true) {
    return `<link rel="modulepreload" href="${file}" crossorigin>`;
  }

  if (cssRE.test(file) === true) {
    return `<link rel="stylesheet" href="${file}">`;
  }

  if (woffRE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="font" type="font/woff" crossorigin>`;
  }

  if (woff2RE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="font" type="font/woff2" crossorigin>`;
  }

  if (gifRE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="image" type="image/gif">`;
  }

  if (jpgRE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="image" type="image/jpeg">`;
  }

  if (pngRE.test(file) === true) {
    return `<link rel="preload" href="${file}" as="image" type="image/png">`;
  }

  return '';
});
