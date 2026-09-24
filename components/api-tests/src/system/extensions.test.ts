/**
 * Система и расширения снаружи: сводка системы (settings, system_status),
 * каталог и установка расширений (extensions), журнал расширений
 * (extensions_logs) и состав рабочих столов, который из каталога собирается.
 *
 * Ставится и снимается «Кооперативный участок» (trustee): у него нет
 * `defaults`, на стенд его не ставит никто, конфиг пустой — установка и
 * удаление возвращают стенд ровно в исходное состояние. Уже установленные
 * расширения тест не трогает: отказы проверяются на неустановленных, а
 * настройки кооператива возвращаются в исходные значения в afterAll.
 */
import crypto from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CHAIRMAN, COOP, COUNCIL, ROLES, caseName, gql, gqlError, tokenOf } from '../core'
import type { GqlError } from '../core'

const AUTH_CODES = ['401', 'UNAUTHENTICATED', 'KIT_USER_NOT_AUTHORIZED', 'KIT_SESSION_ENDED']
function expectAuthDenied(err: GqlError | null): void {
  expect(err, 'ожидался отказ входа').not.toBeNull()
  expect(AUTH_CODES, JSON.stringify(err)).toContain(String(err!.code))
}
function expectCode(err: GqlError | null, code: string): void {
  expect(err, `ожидался отказ ${code}`).not.toBeNull()
  expect(String(err!.code), JSON.stringify(err)).toBe(code)
}

const SETTINGS_FIELDS = 'coopname authorized_default_workspace authorized_default_route non_authorized_default_workspace non_authorized_default_route provider_name is_registration_open updated_at'
const SYSTEM = `query{ getSystemInfo{ coopname system_status settings{ ${SETTINGS_FIELDS} } } }`
const UPDATE_SETTINGS = `mutation($d:UpdateSettingsInput!){ updateSettings(data:$d){ ${SETTINGS_FIELDS} } }`

const EXT_FIELDS = 'name enabled is_installed is_available is_internal config desktops{ name } created_at updated_at'
const EXTENSIONS = `query($d:GetExtensionsInput){ getExtensions(data:$d){ ${EXT_FIELDS} } }`
const INSTALL = `mutation($d:ExtensionInput!){ installExtension(data:$d){ ${EXT_FIELDS} } }`
const UPDATE = `mutation($d:ExtensionInput!){ updateExtension(data:$d){ ${EXT_FIELDS} } }`
const UNINSTALL = 'mutation($d:UninstallExtensionInput!){ uninstallExtension(data:$d) }'
const LOGS = `query($d:GetExtensionLogsInput,$o:PaginationInput){ getExtensionLogs(data:$d, options:$o){
  totalCount currentPage items{ id name extension_local_id data created_at } } }`
const DESKTOP = 'query{ getDesktop{ coopname layout workspaces{ name extension_name title grants } } }'

/** Расширение без defaults: на стенд его не ставит никто, кроме этого теста. */
const PROBE_EXT = 'trustee'

let chairToken: string
let councilToken: string
let memberToken: string
let originalSettings: any

async function extension(name: string): Promise<any> {
  const list = (await gql<any>(chairToken, EXTENSIONS, { d: { name } })).getExtensions
  expect(list, `расширение ${name} в каталоге`).toHaveLength(1)
  return list[0]
}

async function desktopExtensions(token: string | null): Promise<string[]> {
  const d = (await gql<any>(token, DESKTOP)).getDesktop
  expect(d.coopname).toBe(COOP)
  return d.workspaces.map((w: any) => w.extension_name)
}

beforeAll(async () => {
  chairToken = await tokenOf(CHAIRMAN)
  councilToken = await tokenOf(COUNCIL)
  memberToken = await tokenOf(ROLES.member())
  originalSettings = (await gql<any>(null, SYSTEM)).getSystemInfo.settings
})

afterAll(async () => {
  // Настройки кооператива общие для всех файлов прогона — вернуть как были.
  if (originalSettings && chairToken) {
    await gql(chairToken, UPDATE_SETTINGS, {
      d: {
        authorized_default_workspace: originalSettings.authorized_default_workspace,
        authorized_default_route: originalSettings.authorized_default_route,
        non_authorized_default_workspace: originalSettings.non_authorized_default_workspace,
        non_authorized_default_route: originalSettings.non_authorized_default_route,
        provider_name: originalSettings.provider_name,
      },
    })
  }
  // Пробное расширение не должно пережить файл, даже если тест упал посередине.
  if (chairToken) {
    const list = (await gql<any>(chairToken, EXTENSIONS, { d: { name: PROBE_EXT } })).getExtensions
    if (list[0]?.is_installed)
      await gql(chairToken, UNINSTALL, { d: { name: PROBE_EXT } })
  }
})

describe('сводка системы и настройки кооператива', () => {
  it(caseName('sys.ext.happy.01', 'сводка системы открыта гостю: кооператив, статус узла и настройки столов'), async () => {
    const info = (await gql<any>(null, SYSTEM)).getSystemInfo
    expect(info.coopname).toBe(COOP)
    expect(info.system_status).toBe('active')
    expect(info.settings.coopname).toBe(COOP)
    expect(info.settings.authorized_default_workspace).toBeTruthy()
    expect(info.settings.non_authorized_default_workspace).toBeTruthy()
  })

  it(caseName('sys.ext.happy.02', 'председатель меняет одну настройку — остальные не трогаются, сводка отдаёт новое значение'), async () => {
    const route = `/api-tests/${crypto.randomBytes(4).toString('hex')}`
    const updated = (await gql<any>(chairToken, UPDATE_SETTINGS, { d: { authorized_default_route: route } })).updateSettings
    expect(updated.authorized_default_route).toBe(route)
    expect(updated.authorized_default_workspace).toBe(originalSettings.authorized_default_workspace)
    expect(updated.non_authorized_default_route).toBe(originalSettings.non_authorized_default_route)
    expect(updated.provider_name).toBe(originalSettings.provider_name)

    const seen = (await gql<any>(memberToken, SYSTEM)).getSystemInfo.settings
    expect(seen.authorized_default_route).toBe(route)

    const back = (await gql<any>(chairToken, UPDATE_SETTINGS, { d: { authorized_default_route: originalSettings.authorized_default_route } })).updateSettings
    expect(back.authorized_default_route).toBe(originalSettings.authorized_default_route)
  })

  it(caseName('sys.ext.side.01', 'настройки меняет только председатель'), async () => {
    const d = { d: { authorized_default_route: '/hijack' } }
    expectCode(await gqlError(councilToken, UPDATE_SETTINGS, d), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, UPDATE_SETTINGS, d), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, UPDATE_SETTINGS, d))
    const seen = (await gql<any>(null, SYSTEM)).getSystemInfo.settings
    expect(seen.authorized_default_route).toBe(originalSettings.authorized_default_route)
  })
})

describe('каталог расширений и рабочие столы', () => {
  it(caseName('sys.ext.happy.03', 'каталог: установленные по умолчанию отмечены, закрытое везде — недоступно'), async () => {
    const powerup = await extension('powerup')
    expect(powerup).toMatchObject({ is_installed: true, enabled: true, is_available: true })
    const yookassa = await extension('yookassa')
    expect(yookassa).toMatchObject({ is_installed: false, is_available: false })
    const probe = await extension(PROBE_EXT)
    expect(probe.is_installed, `${PROBE_EXT} не должен стоять на стенде до теста`).toBe(false)
    expect(probe.desktops.map((d: any) => d.name)).toContain(PROBE_EXT)

    const installed = (await gql<any>(chairToken, EXTENSIONS, { d: { is_installed: true } })).getExtensions
    expect(installed.length).toBeGreaterThan(0)
    expect(installed.every((e: any) => e.is_installed)).toBe(true)
  })

  it(caseName('ext.avail.side.02', 'расширение, открытое только вне основной сети, на тестовом контуре доступно'), async () => {
    const market = await extension('market')
    expect(market.is_available).toBe(true)
  })

  it(caseName('sys.ext.side.02', 'каталог и установка — только председателю'), async () => {
    expectCode(await gqlError(councilToken, EXTENSIONS, { d: { name: 'powerup' } }), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, EXTENSIONS, { d: { name: 'powerup' } }), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, EXTENSIONS, { d: { name: 'powerup' } }))
    const d = { d: { name: PROBE_EXT, enabled: true, config: {} } }
    expectCode(await gqlError(councilToken, INSTALL, d), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, INSTALL, d), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, UPDATE, d), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(memberToken, UNINSTALL, { d: { name: 'powerup' } }), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, UNINSTALL, { d: { name: 'powerup' } }))
    expect((await extension(PROBE_EXT)).is_installed).toBe(false)
    expect((await extension('powerup')).is_installed).toBe(true)
  })

  it(caseName('ext.avail.side.03', 'закрытое везде расширение на тестовом контуре не ставится'), async () => {
    expectCode(await gqlError(chairToken, INSTALL, { d: { name: 'yookassa', enabled: false, config: { client: '', secret: '' } } }), 'EXTENSION_NOT_AVAILABLE_FOR_INSTALL')
    expect((await extension('yookassa')).is_installed).toBe(false)
  })

  it(caseName('ext.avail.break.01', 'прямой вызов установки закрытого приложения: пайщику — отказ по роли, председателю — отказ по сети'), async () => {
    const d = { d: { name: 'sberpoll', enabled: false, config: {} } }
    expectCode(await gqlError(memberToken, INSTALL, d), 'KIT_INSUFFICIENT_RIGHTS')
    expectCode(await gqlError(chairToken, INSTALL, d), 'EXTENSION_NOT_AVAILABLE_FOR_INSTALL')
    expect((await extension('sberpoll')).is_installed).toBe(false)
  })

  it(caseName('ext.avail.break.02', 'установка по имени, которого нет в реестре'), async () => {
    expectCode(await gqlError(chairToken, INSTALL, { d: { name: `nope${crypto.randomBytes(3).toString('hex')}`, enabled: true, config: {} } }), 'EXTENSION_NOT_FOUND')
  })

  it(caseName('sys.ext.side.03', 'обновить неустановленное нельзя; конфиг, не прошедший схему, не пишется'), async () => {
    expectCode(await gqlError(chairToken, UPDATE, { d: { name: PROBE_EXT, enabled: true, config: {} } }), 'DATABASE_EXTENSION_NOT_INSTALLED')
    expectCode(await gqlError(chairToken, UPDATE, { d: { name: 'yookassa', enabled: false, config: { client: 1 } } }), 'EXTENSION_CONFIG_VALIDATION_FAILED')
    expect((await extension(PROBE_EXT)).is_installed).toBe(false)
    expect((await extension('yookassa')).is_installed).toBe(false)
  })

  it(caseName('sys.ext.happy.04', 'установка, выключение и удаление расширения — каталог и состав рабочих столов следуют'), async () => {
    expect(await desktopExtensions(null)).not.toContain(PROBE_EXT)

    const installed = (await gql<any>(chairToken, INSTALL, { d: { name: PROBE_EXT, enabled: true, config: {} } })).installExtension
    expect(installed).toMatchObject({ name: PROBE_EXT, is_installed: true, enabled: true })
    expect(await extension(PROBE_EXT)).toMatchObject({ is_installed: true, enabled: true })
    expect(await desktopExtensions(null)).toContain(PROBE_EXT)
    expect(await desktopExtensions(memberToken)).toContain(PROBE_EXT)

    // повторная установка поверх установленного отвергается, запись остаётся
    expect(await gqlError(chairToken, INSTALL, { d: { name: PROBE_EXT, enabled: false, config: {} } }), 'повторная установка').not.toBeNull()
    expect(await extension(PROBE_EXT)).toMatchObject({ is_installed: true, enabled: true })

    const off = (await gql<any>(chairToken, UPDATE, { d: { name: PROBE_EXT, enabled: false, config: {} } })).updateExtension
    expect(off).toMatchObject({ name: PROBE_EXT, is_installed: true, enabled: false })
    expect(await desktopExtensions(null)).not.toContain(PROBE_EXT)

    expect((await gql<any>(chairToken, UNINSTALL, { d: { name: PROBE_EXT } })).uninstallExtension).toBe(true)
    expect((await extension(PROBE_EXT)).is_installed).toBe(false)
    expect(await desktopExtensions(null)).not.toContain(PROBE_EXT)

    // повтор удаления — ничего не удалено
    expect((await gql<any>(chairToken, UNINSTALL, { d: { name: PROBE_EXT } })).uninstallExtension).toBe(false)
  })

  it(caseName('sys.ext.side.04', 'рабочий стол по негодному токену — отказ, а не гостевой ответ'), async () => {
    const err = await gqlError('not-a-token', DESKTOP)
    expectAuthDenied(err)
  })
})

describe('журнал расширений', () => {
  it(caseName('sys.ext.happy.05', 'журнал фильтруется по расширению; неизвестное имя — пустой журнал'), async () => {
    const all = (await gql<any>(chairToken, LOGS, { d: {}, o: { page: 1, limit: 50, sortOrder: 'DESC' } })).getExtensionLogs
    // eslint-disable-next-line no-console
    console.log('[extensions_logs]', JSON.stringify({ total: all.totalCount, names: [...new Set(all.items.map((i: any) => i.name))] }))
    const powerup = (await gql<any>(councilToken, LOGS, { d: { name: 'powerup' }, o: { page: 1, limit: 50, sortOrder: 'DESC' } })).getExtensionLogs
    expect(powerup.items.every((i: any) => i.name === 'powerup')).toBe(true)
    expect(powerup.totalCount).toBeLessThanOrEqual(all.totalCount)

    const none = (await gql<any>(chairToken, LOGS, { d: { name: `nope${crypto.randomBytes(3).toString('hex')}` } })).getExtensionLogs
    expect(none).toMatchObject({ totalCount: 0, items: [] })
  })

  it(caseName('sys.ext.side.05', 'журнал расширений пайщику и гостю закрыт'), async () => {
    expectCode(await gqlError(memberToken, LOGS, { d: {} }), 'KIT_INSUFFICIENT_RIGHTS')
    expectAuthDenied(await gqlError(null, LOGS, { d: {} }))
  })
})
