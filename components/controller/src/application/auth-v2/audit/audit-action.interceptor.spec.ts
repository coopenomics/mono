import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuditActionInterceptor } from './audit-action.interceptor';
import type { AuditService } from './audit.service';

function makeInterceptor(meta: { category: string } | undefined) {
  const record = jest.fn((_rec: Parameters<AuditService['record']>[0]) => Promise.resolve());
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(meta) } as unknown as Reflector;
  const interceptor = new AuditActionInterceptor(reflector, { record } as unknown as AuditService);
  return { interceptor, record };
}

function httpCtx(handlerName: string, req: Record<string, unknown>): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => ({ name: handlerName }),
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

/** Фейковый GraphQL ExecutionContext (как в authorization.guard.spec). */
function gqlCtx(handlerName: string, args: Record<string, unknown>, reqObj: unknown): ExecutionContext {
  const gqlArgs = [{}, args, { req: reqObj }, {}];
  return {
    getType: () => 'graphql',
    getHandler: () => ({ name: handlerName }),
    getClass: () => class {},
    getArgs: () => gqlArgs,
    getArgByIndex: (i: number) => gqlArgs[i],
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

const okHandler = (value: unknown = { ok: true }): CallHandler => ({ handle: () => of(value) });
const errHandler = (err: unknown): CallHandler => ({ handle: () => throwError(() => err) });
const flush = () => new Promise((r) => setImmediate(r));

describe('AuditActionInterceptor — авто-аудит admin-действий (Story 8.5)', () => {
  it('нет @AuditAction → запись не делается, хэндлер проходит', async () => {
    const { interceptor, record } = makeInterceptor(undefined);
    const res = await firstValueFrom(interceptor.intercept(httpCtx('changeRoles', { user: {} }), okHandler('R')));
    await flush();
    expect(res).toBe('R');
    expect(record).not.toHaveBeenCalled();
  });

  it('HTTP success: event=coopid.admin.<handler>, subjectId=target_id, actor, result=success', async () => {
    const { interceptor, record } = makeInterceptor({ category: 'admin' });
    const req = { user: { username: 'chief' }, params: { target_id: 'p1' }, query: {}, body: { role: 'member' } };
    await firstValueFrom(interceptor.intercept(httpCtx('changeRoles', req), okHandler()));
    await flush();
    expect(record).toHaveBeenCalledWith({
      event: 'coopid.admin.changeRoles',
      subjectId: 'p1',
      actor: 'chief',
      result: 'success',
      context: { target_id: 'p1', role: 'member' },
    });
  });

  it('subjectId фолбэк на id, если нет target_id', async () => {
    const { interceptor, record } = makeInterceptor({ category: 'admin' });
    const req = { user: { username: 'chief' }, params: {}, query: {}, body: { id: 'x9' } };
    await firstValueFrom(interceptor.intercept(httpCtx('grantCapability', req), okHandler()));
    await flush();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ event: 'coopid.admin.grantCapability', subjectId: 'x9' }));
  });

  it('GraphQL: args берутся из data', async () => {
    const { interceptor, record } = makeInterceptor({ category: 'admin' });
    const ctx = gqlCtx('excludeParticipant', { data: { target_id: 'p7', reason: 'x' } }, { user: { username: 'chief' } });
    await firstValueFrom(interceptor.intercept(ctx, okHandler()));
    await flush();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      event: 'coopid.admin.excludeParticipant',
      subjectId: 'p7',
      context: { target_id: 'p7', reason: 'x' },
    }));
  });

  it('секреты выкинуты в _redacted (вкл. вложенность), запись проходит secret-blacklist', async () => {
    const { interceptor, record } = makeInterceptor({ category: 'admin' });
    const req = {
      user: { username: 'chief' },
      params: { target_id: 'p1' },
      query: {},
      body: { access_token: 'T', nested: { private_key: 'K', keep: 1 }, signature: 'S', ok: 'v' },
    };
    await firstValueFrom(interceptor.intercept(httpCtx('rotate', req), okHandler()));
    await flush();
    const ctx = record.mock.calls[0][0].context as Record<string, unknown>;
    expect(ctx.ok).toBe('v');
    expect(ctx.access_token).toBeUndefined();
    expect(ctx.signature).toBeUndefined();
    expect(ctx._redacted).toEqual(expect.arrayContaining(['access_token', 'signature']));
    expect((ctx.nested as Record<string, unknown>).private_key).toBeUndefined();
    expect((ctx.nested as Record<string, unknown>)._redacted).toEqual(['private_key']);
    expect((ctx.nested as Record<string, unknown>).keep).toBe(1);
  });

  it('ошибка резолвера → result=failure + rethrow исходной ошибки', async () => {
    const { interceptor, record } = makeInterceptor({ category: 'admin' });
    const boom = new Error('boom');
    const req = { user: { username: 'chief' }, params: { target_id: 'p1' }, query: {}, body: {} };
    await expect(firstValueFrom(interceptor.intercept(httpCtx('changeRoles', req), errHandler(boom)))).rejects.toBe(boom);
    await flush();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      event: 'coopid.admin.changeRoles',
      result: 'failure',
      context: expect.objectContaining({ _error: 'boom' }),
    }));
  });
});
