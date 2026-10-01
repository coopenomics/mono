#!/usr/bin/env node
// Подставной внешний узел для стенда внешнего слоя (C28-80).
//
// Платформа разговаривает с чужими узлами — сетью карт кооператора и другими.
// На стенде их нет, а ходить с тестовыми данными на боевые адреса нельзя: исход
// (принят / отвергнут / не доставлен) зависел бы от чужого узла. Этот сервис
// живёт в сети стенда и отвечает так, как велит тест, а всё полученное
// записывает — тест сверяет, что именно платформа отправила.
//
// Два порта:
//   STUB_PORT (8090)     — сам «чужой узел», сюда ходит контроллер;
//   CONTROL_PORT (8091)  — управление, проброшен только на loopback хоста.
//
// Управление:
//   POST /reset                    — забыть маршруты и журнал;
//   POST /routes  {method, path, responses:[{status, body, headers, delayMs}]}
//        ответы отдаются по очереди, последний повторяется; `path` — точный
//        путь либо префикс со звёздочкой в конце (`/v1/attestations/*`);
//   GET  /requests[?path=…]        — журнал полученных запросов;
//   GET  /health.
// Незапрограммированный путь отвечает 404 — молчаливого «успеха» нет.
import http from 'node:http';

const STUB_PORT = Number(process.env.STUB_PORT) || 8090;
const CONTROL_PORT = Number(process.env.CONTROL_PORT) || 8091;

/** @type {{method: string, path: string, responses: any[], served: number}[]} */
let routes = [];
/** @type {{method: string, path: string, query: Record<string,string>, headers: Record<string,string>, body: unknown, at: string}[]} */
let requests = [];

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolve(undefined);
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(text);
      }
    });
  });

const send = (res, status, body, headers = {}) => {
  const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    ...(typeof body === 'string' || body === undefined ? {} : { 'content-type': 'application/json' }),
    ...headers,
  });
  res.end(payload);
};

const matches = (route, method, path) =>
  (route.method === '*' || route.method === method) &&
  (route.path.endsWith('*') ? path.startsWith(route.path.slice(0, -1)) : route.path === path);

const stub = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://stub');
  const method = (req.method ?? 'GET').toUpperCase();
  const body = await readBody(req);
  requests.push({
    method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: /** @type {Record<string,string>} */ (req.headers),
    body,
    at: new Date().toISOString(),
  });
  // Точный путь важнее префикса: программировать можно и то и другое.
  const route =
    routes.find((r) => !r.path.endsWith('*') && matches(r, method, url.pathname)) ??
    routes.find((r) => matches(r, method, url.pathname));
  if (!route) return send(res, 404, { error: 'stub: маршрут не запрограммирован', method, path: url.pathname });
  const response = route.responses[Math.min(route.served, route.responses.length - 1)];
  route.served += 1;
  if (response.delayMs) await new Promise((r) => setTimeout(r, response.delayMs));
  send(res, response.status ?? 200, response.body, response.headers ?? {});
});

const control = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://control');
  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
  if (method === 'POST' && url.pathname === '/reset') {
    routes = [];
    requests = [];
    return send(res, 200, { ok: true });
  }
  if (method === 'POST' && url.pathname === '/routes') {
    const body = /** @type {any} */ (await readBody(req));
    if (!body?.path || !Array.isArray(body.responses) || body.responses.length === 0) {
      return send(res, 400, { error: 'нужны path и непустой responses' });
    }
    const next = { method: String(body.method ?? '*').toUpperCase(), path: String(body.path), responses: body.responses, served: 0 };
    routes = routes.filter((r) => !(r.method === next.method && r.path === next.path));
    routes.push(next);
    return send(res, 200, { ok: true });
  }
  if (method === 'GET' && url.pathname === '/requests') {
    const path = url.searchParams.get('path');
    return send(res, 200, path ? requests.filter((r) => r.path === path || (path.endsWith('*') && r.path.startsWith(path.slice(0, -1)))) : requests);
  }
  send(res, 404, { error: 'нет такой команды управления' });
});

stub.listen(STUB_PORT, '0.0.0.0', () => console.log(`stub: узел слушает :${STUB_PORT}`));
control.listen(CONTROL_PORT, '0.0.0.0', () => console.log(`stub: управление слушает :${CONTROL_PORT}`));
