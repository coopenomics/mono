/**
 * Что обещают декораторы резолверов: какие проверки стоят на операции и
 * каким ролям она открыта. Исходники разбираются парсером TypeScript (без
 * проверки типов — это секунды): методы с @Query/@Mutation, их @UseGuards и
 * @AuthRoles, плюс те же декораторы на классе резолвера.
 *
 * Схема GraphQL ролей не несёт, поэтому ожидание берётся отсюда, а
 * фактическое поведение — из вызова (matrix.test.ts). Расхождение двух и есть
 * находка: либо проверка слабее обещанной, либо обещание устарело.
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { REPO_ROOT } from '../core/env'

export interface DeclaredOp {
  name: string
  kind: 'query' | 'mutation' | 'subscription'
  file: string
  guards: string[]
  /** null — @AuthRoles нет; [] — роли не открыты никому (только «сам себе»). */
  roles: string[] | null
  allowSelf: boolean
  anyStatus: boolean
  /** @RequireMarketplaceAccess('Resource', 'action' | [...]) */
  marketplaceAccess: string[] | null
}

const ROOTS = ['components/controller/src']

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dist')
        walk(p, out)
    }
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && !e.name.endsWith('.d.ts')) {
      out.push(p)
    }
  }
  return out
}

function decoratorsOf(node: ts.Node): ts.Decorator[] {
  return (ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined)?.slice() ?? []
}

function callOf(d: ts.Decorator): { name: string, args: readonly ts.Expression[] } | null {
  const e = d.expression
  if (ts.isCallExpression(e)) {
    const callee = e.expression
    const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : ''
    return { name, args: e.arguments }
  }
  if (ts.isIdentifier(e))
    return { name: e.text, args: [] }
  return null
}

function strings(e: ts.Expression | undefined): string[] {
  if (!e)
    return []
  if (ts.isStringLiteralLike(e))
    return [e.text]
  if (ts.isArrayLiteralExpression(e))
    return e.elements.flatMap(x => strings(x as ts.Expression))
  return []
}

function objProp(e: ts.Expression | undefined, key: string): ts.Expression | undefined {
  if (!e || !ts.isObjectLiteralExpression(e))
    return undefined
  for (const p of e.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key)
      return p.initializer
  }
  return undefined
}

interface Checks { guards: string[], roles: string[] | null, allowSelf: boolean, anyStatus: boolean, marketplaceAccess: string[] | null }

function checksOf(decorators: ts.Decorator[]): Checks {
  const c: Checks = { guards: [], roles: null, allowSelf: true, anyStatus: false, marketplaceAccess: null }
  for (const d of decorators) {
    const call = callOf(d)
    if (!call)
      continue
    if (call.name === 'UseGuards')
      c.guards.push(...call.args.map(a => a.getText()))
    if (call.name === 'AuthRoles') {
      c.roles = strings(call.args[0])
      const opts = call.args[1]
      if (objProp(opts, 'allowSelf')?.kind === ts.SyntaxKind.FalseKeyword)
        c.allowSelf = false
      if (objProp(opts, 'anyStatus')?.kind === ts.SyntaxKind.TrueKeyword)
        c.anyStatus = true
    }
    if (call.name === 'RequireMarketplaceAccess') {
      const resource = strings(call.args[0])[0] ?? '?'
      c.marketplaceAccess = strings(call.args[1]).map(a => `${resource}:${a}`)
    }
  }
  return c
}

export function declaredOps(): DeclaredOp[] {
  const out: DeclaredOp[] = []
  for (const root of ROOTS) {
    for (const file of walk(path.join(REPO_ROOT, root))) {
      const text = fs.readFileSync(file, 'utf8')
      if (!/@(Query|Mutation|Subscription)\(/.test(text))
        continue
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
      const visit = (node: ts.Node): void => {
        if (ts.isClassDeclaration(node)) {
          const cls = checksOf(decoratorsOf(node))
          for (const m of node.members) {
            if (!ts.isMethodDeclaration(m))
              continue
            const decs = decoratorsOf(m)
            for (const d of decs) {
              const call = callOf(d)
              if (!call || !['Query', 'Mutation', 'Subscription'].includes(call.name))
                continue
              const opts = call.args.find(a => ts.isObjectLiteralExpression(a))
              const explicit = strings(objProp(opts, 'name'))[0]
              const methodName = m.name && ts.isIdentifier(m.name) ? m.name.text : m.name?.getText() ?? '?'
              const own = checksOf(decs)
              out.push({
                name: explicit ?? methodName,
                kind: call.name.toLowerCase() as DeclaredOp['kind'],
                file: path.relative(REPO_ROOT, file),
                guards: [...cls.guards, ...own.guards],
                roles: own.roles ?? cls.roles,
                allowSelf: own.allowSelf && cls.allowSelf,
                anyStatus: own.anyStatus || cls.anyStatus,
                marketplaceAccess: own.marketplaceAccess ?? cls.marketplaceAccess,
              })
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }
  }
  return out
}

/** Роль платформы участника каталога ролей. */
export type PlatformRole = 'guest' | 'user' | 'member' | 'chairman'

/**
 * Ожидаемый исход по декораторам: 'allow' | 'deny' | null (не выводится —
 * решают данные: Стол заказов, CASL, проверки в сервисе).
 */
export function expectedFor(op: DeclaredOp, role: PlatformRole): 'allow' | 'deny' | null {
  const guards = op.guards.join(' ')
  const hasJwt = op.guards.includes('GqlJwtAuthGuard')
  const optionalJwt = op.guards.includes('OptionalGqlJwtAuthGuard')
  if (op.marketplaceAccess || /Marketplace|AuthorizationGuard/.test(guards))
    return role === 'guest' && hasJwt ? 'deny' : null
  if (!hasJwt)
    return optionalJwt || op.guards.length === 0 ? (role === 'guest' ? 'allow' : null) : null
  if (role === 'guest')
    return 'deny'
  if (!/RolesGuard/.test(guards) || op.roles === null)
    return 'allow'
  return op.roles.includes(role) ? 'allow' : 'deny'
}
