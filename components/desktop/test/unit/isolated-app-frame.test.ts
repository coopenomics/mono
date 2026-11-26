/**
 * Изолированная рамка приложения каталога (487-18): разбор описателя фронта и
 * сообщений моста. Обе стороны составил недоверенный код издателя — стол
 * исполняет только то, что прошло проверку.
 */
import { describe, expect, it } from 'vitest';
import { BRIDGE_MARK, packageCoords, parseBridgeRequest, withFramePolicy } from 'src/widgets/IsolatedAppFrame/model/bridge';
import { parseFrameDescriptor } from 'src/widgets/IsolatedAppFrame/model/descriptor';

const HASH = 'a'.repeat(64);
const msg = (over: Record<string, unknown>) => ({ coopBridge: BRIDGE_MARK, id: 1, method: 'init', params: {}, ...over });

describe('мост стола: разбор сообщения рамки', () => {
  it('happy: init — команда без параметров, лишние поля отброшены', () => {
    expect(parseBridgeRequest(msg({ params: { evil: 1 } }))).toEqual({ id: 1, method: 'init', params: {} });
  });

  it('happy: graphql — запрос и переменные; переменных нет — пустой объект', () => {
    expect(parseBridgeRequest(msg({ method: 'graphql', params: { query: '{ a }', variables: { x: 1 }, token: 'украсть' } }))).toEqual({
      id: 1,
      method: 'graphql',
      params: { query: '{ a }', variables: { x: 1 } },
    });
    expect(parseBridgeRequest(msg({ method: 'graphql', params: { query: '{ a }' } }))).toMatchObject({ params: { variables: {} } });
  });

  it('happy: sign — только хэш документа, приведённый к верхнему регистру', () => {
    expect(parseBridgeRequest(msg({ method: 'sign', params: { hash: HASH, html: '<b>подмена</b>', document: {} } }))).toEqual({
      id: 1,
      method: 'sign',
      params: { hash: HASH.toUpperCase() },
    });
  });

  it.each(['getMemberToken', 'transact', 'eval', 'navigate', ''])('break: команда «%s» вне перечня — отказ с её именем', (method) => {
    expect(parseBridgeRequest(msg({ method }))).toEqual({ refusal: 'unknownMethod', id: 1, method });
  });

  it('break: sign без хэша, с хэшем неверной длины и с документом вместо хэша — отказ', () => {
    for (const params of [{}, { hash: 'abc' }, { hash: 123 }, { document: { hash: HASH } }]) {
      expect(parseBridgeRequest(msg({ method: 'sign', params }))).toEqual({ refusal: 'badRequest', id: 1 });
    }
  });

  it('break: graphql без запроса, с запросом длиннее предела и с переменными-строкой — отказ', () => {
    for (const params of [{}, { query: '' }, { query: 'x'.repeat(20_001) }, { query: '{ a }', variables: 'x' }]) {
      expect(parseBridgeRequest(msg({ method: 'graphql', params }))).toEqual({ refusal: 'badRequest', id: 1 });
    }
  });

  it('side: чужое сообщение (без признака моста, без идентификатора, не объект) — не мост, ответа нет', () => {
    for (const data of [null, 'text', 42, {}, { coopBridge: 2, id: 1, method: 'init' }, { coopBridge: BRIDGE_MARK, method: 'init' }]) {
      expect(parseBridgeRequest(data)).toEqual({ refusal: 'notBridge' });
    }
  });
});

describe('политика рамки', () => {
  it('happy: политика стоит сразу после doctype — раньше любого содержимого страницы', () => {
    const out = withFramePolicy('<!doctype html><html><head><script>x()</script></head></html>');
    expect(out.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"')).toBe(true);
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<script>'));
    expect(out).toContain("default-src 'none'");
  });

  it('side: страница без doctype — политика первой строкой', () => {
    expect(withFramePolicy('<p>x</p>').startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true);
  });

  it('break: сеть рамке закрыта — connect-src отдельно не разрешён', () => {
    expect(withFramePolicy('<p/>')).not.toContain('connect-src');
  });
});

describe('описатель фронта', () => {
  const descriptor = (over: Record<string, unknown> = {}) =>
    JSON.stringify({ coopenomicsFrontend: 'frame', workspace: { name: 'exampleapp', title: 'Example', icon: 'extension' }, html: '<p>x</p>', ...over });

  it('happy: описатель разобран — рабочий стол и страница', () => {
    expect(parseFrameDescriptor(descriptor())).toEqual({
      workspace: { name: 'exampleapp', title: 'Example', icon: 'extension' },
      html: '<p>x</p>',
    });
  });

  it('side: прежний сценарий install.js и JSON без признака — не описатель (null)', () => {
    expect(parseFrameDescriptor("'use strict';\nmodule.exports = { install() {} };")).toBeNull();
    expect(parseFrameDescriptor('{ "workspace": {} }')).toBeNull();
    expect(parseFrameDescriptor('{ not json')).toBeNull();
  });

  it('side: значок вне формата заменяется значком по умолчанию', () => {
    expect(parseFrameDescriptor(descriptor({ workspace: { name: 'exampleapp', title: 'Example', icon: '<img onerror=x>' } }))?.workspace.icon).toBe('extension');
  });

  it.each([
    ['имя стола с путём', { workspace: { name: '../admin', title: 'X' } }],
    ['имя стола пустое', { workspace: { name: '', title: 'X' } }],
    ['заголовок пуст', { workspace: { name: 'exampleapp', title: '' } }],
    ['заголовок длиннее предела', { workspace: { name: 'exampleapp', title: 'x'.repeat(61) } }],
    ['страница пуста', { html: '' }],
    ['страница не строка', { html: { a: 1 } }],
  ])('break: %s — описатель отклонён, как сценарий он не выполняется', (_title, over) => {
    expect(() => parseFrameDescriptor(descriptor(over))).toThrow(/описатель фронта/);
  });
});

describe('координаты пакета', () => {
  it('happy и break', () => {
    expect(packageCoords('@voskhod/exampleapp')).toEqual({ scope: 'voskhod', name: 'exampleapp' });
    expect(packageCoords('exampleapp')).toBeNull();
    expect(packageCoords('@voskhod/../x')).toBeNull();
  });
});
