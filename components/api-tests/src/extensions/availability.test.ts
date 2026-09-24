/**
 * Доступность расширений в зависимости от сети узла (extensions.availability).
 *
 * Стенд полигона — не основная сеть. Значит, открытые везде и открытые только
 * вне основной сети приложения здесь доступны, а закрытые везде (NOWHERE)
 * недоступны: тестовый контур послаблением не является. Сервер сторожит
 * установку сам — скрытая карточка в каталоге защитой не считается.
 *
 * Поведение основной сети (side.01, side.05) снаружи стенда не проверить: сеть
 * узла задаётся его CHAIN_ID при запуске.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, caseName, gql, gqlRaw, tokenOf } from '../core'

const LIST = `query($d:GetExtensionsInput){ getExtensions(data:$d){ name is_available is_installed enabled config } }`
const INSTALL = `mutation($d:ExtensionInput!){ installExtension(data:$d){ name is_installed } }`

/** Открыто везде. */
const EVERYWHERE = ['soviet', 'chairman', 'participant']
/** Открыто только вне основной сети. */
const NON_MAINNET_ONLY = ['market']
/** Закрыто везде: ещё не открыто для установки. */
const NOWHERE = ['yookassa', 'sberpoll']

async function catalog(): Promise<Map<string, any>> {
  const d = await gql<any>(await tokenOf(CHAIRMAN), LIST, { d: {} })
  return new Map((d.getExtensions as any[]).map(e => [e.name, e]))
}

async function install(name: string, config: unknown = {}) {
  return gqlRaw<any>(await tokenOf(CHAIRMAN), INSTALL, { d: { name, enabled: true, config } })
}

/** Установка упёрлась в сторожа доступности либо реестра. */
const GATE_CODES = ['EXTENSION_NOT_AVAILABLE_FOR_INSTALL', 'EXTENSION_NOT_FOUND']

describe('extensions.availability: доступность расширений по сети узла', () => {
  it(caseName('ext.avail.happy.01', 'открытое везде расширение отдаётся доступным, сторож установки его пропускает'), async () => {
    const all = await catalog()
    for (const name of EVERYWHERE) {
      const ext = all.get(name)
      expect(ext, name).toBeDefined()
      expect(ext.is_available, name).toBe(true)
    }
    // Повторная установка уже стоящего расширения проходит сторожа доступности
    // и упирается только в «уже установлено» — само расширение не трогается.
    const soviet = all.get('soviet')
    expect(soviet.is_installed).toBe(true)
    const r = await install('soviet', soviet.config ?? {})
    expect(r.errors.length).toBeGreaterThan(0)
    expect(GATE_CODES).not.toContain(r.errors[0].code)
    expect(r.errors[0].message).toMatch(/already installed/i)
  })

  it(caseName('ext.avail.side.02', 'открытое только вне основной сети расширение на тестовом контуре доступно'), async () => {
    const all = await catalog()
    for (const name of NON_MAINNET_ONLY) {
      const ext = all.get(name)
      expect(ext, name).toBeDefined()
      expect(ext.is_available, name).toBe(true)
      // Сторожа проверяем повторной установкой только стоящего расширения:
      // чистая установка поменяла бы стенд для следующих файлов прогона.
      if (ext.is_installed) {
        const r = await install(name, ext.config ?? {})
        expect(r.errors.length).toBeGreaterThan(0)
        expect(GATE_CODES, `${name}: ${r.errors[0].message}`).not.toContain(r.errors[0].code)
      }
    }
  })

  it(caseName('ext.avail.side.03', 'закрытое везде расширение недоступно и вне основной сети, в состав столов не попадает'), async () => {
    const all = await catalog()
    for (const name of NOWHERE) {
      const ext = all.get(name)
      expect(ext, name).toBeDefined()
      expect(ext.is_available, name).toBe(false)
    }
    const filtered = await gql<any>(await tokenOf(CHAIRMAN), LIST, { d: { is_available: true } })
    const names = (filtered.getExtensions as any[]).map(e => e.name)
    for (const name of NOWHERE) expect(names).not.toContain(name)

    for (const token of [null, await tokenOf(CHAIRMAN)]) {
      const desk = await gql<any>(token, `query{ getDesktop{ workspaces{ extension_name name } } }`)
      const owners = (desk.getDesktop.workspaces as any[]).map(w => w.extension_name)
      for (const name of NOWHERE) expect(owners).not.toContain(name)
    }
  })

  it(caseName('ext.avail.break.01', 'прямой вызов установки закрытого в этой сети приложения — отказ сервера'), async () => {
    for (const name of NOWHERE) {
      const r = await install(name)
      expect(r.errors[0]?.code, name).toBe('EXTENSION_NOT_AVAILABLE_FOR_INSTALL')
    }
    const after = await catalog()
    for (const name of NOWHERE) expect(after.get(name).is_installed, name).toBe(false)
  })

  it(caseName('ext.avail.break.02', 'имя не из реестра — отказ «приложение не найдено»'), async () => {
    const r = await install('nosuchapp123')
    expect(r.errors[0]?.code).toBe('EXTENSION_NOT_FOUND')
    expect(r.errors[0]?.message).toContain('nosuchapp123')
    expect((await catalog()).has('nosuchapp123')).toBe(false)
  })
})
