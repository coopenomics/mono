import { computed, type ComputedRef } from 'vue'
import type { IReportRequisitesView } from 'src/entities/Report'

/**
 * Общий парсер XML ФНС/СФР для визуальных форм. Одна точка входа: получает
 * xml+requisites+year через reactive-геттеры, возвращает `doc` (Document),
 * шапку документа (шаг 1 — все ФНС-отчёты имеют одинаковую <СвНП>/<НПЮЛ>/
 * <Подписант>), и helper'ы для чтения атрибутов по CSS-селектору.
 *
 * Формы подключают composable в <script setup> и поверх него парсят уже
 * свои разделы (баланс, раздел 2.1 ЕФС-1, и т.п.) — каждая знает про свой
 * специфический формат.
 */
export interface BaseHeader {
  inn: string
  kpp: string
  orgName: string
  address: string
  okpo: string
  okfs: string
  okopf: string
  okved: string
  oktmo: string
  okei: string
  period: string
  year: number
  correctionNumber: string
  kodNO: string
  docDate: string
  signerType: 'chairman' | 'representative'
  signerLastName: string
  signerFirstName: string
  signerMiddleName: string
  signerRepDoc: string
  signerSnils: string
  /** Рег. номер ПФР — читается из тега `<РегНомер>` ЕФС-1 (fss4.generator.ts кладёт туда именно ПФР, не СФР). */
  pfrRegNumber: string
}

export interface UseReportXmlReturn {
  doc: ComputedRef<Document | null>
  header: ComputedRef<BaseHeader>
  getAttr: (selector: string, attr: string) => string
  getNum: (selector: string, attr: string) => number
  /** Ищет элемент по локальному имени, игнорируя namespace (для ЕФС-1). */
  getByLocal: (localName: string) => Element | null
  getAllByLocal: (localName: string) => Element[]
  /** Читает textContent элемента по localName. */
  getText: (localName: string) => string
  /**
   * 12 ячеек ИНН для типографской «решётки»: юрлицо (10 цифр) = 10 занятых
   * + 2 пустых, ИП (12 цифр) = все 12.
   */
  padInn: (inn: string) => { idx: number; val: string }[]
  /** `YYYY-MM-DD` → `DD.MM.YYYY`. Пустая строка при пустом вводе. */
  formatDate: (s: string) => string
  /** Число → RU-форматированная строка; 0/undefined → «—». */
  fmt: (n?: number) => string
  /** Число → RU-форматированная строка всегда (0 остаётся «0»). */
  fmtZero: (n?: number) => string
}

export function useReportXml(
  xmlGetter: () => string,
  requisitesGetter: () => IReportRequisitesView | null,
  yearGetter: () => number | undefined,
): UseReportXmlReturn {
  const doc = computed<Document | null>(() => {
    const xml = xmlGetter()
    if (!xml) return null
    try {
      const d = new DOMParser().parseFromString(xml, 'text/xml')
      if (d.querySelector('parsererror')) return null
      return d
    } catch {
      return null
    }
  })

  const getAttr = (selector: string, attr: string): string => {
    const el = doc.value?.querySelector(selector)
    return el?.getAttribute(attr) ?? ''
  }

  const getNum = (selector: string, attr: string): number => {
    const v = getAttr(selector, attr)
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  // Для ЕФС-1 теги с namespace-prefix (ЕФС8:ИНН и т.п.). CSS-селектор не
  // умеет по `:`, используем getElementsByTagNameNS('*', localName) —
  // вернёт все элементы с таким localName вне зависимости от namespace.
  const getAllByLocal = (localName: string): Element[] => {
    const d = doc.value
    if (!d) return []
    return Array.from(d.getElementsByTagNameNS('*', localName))
  }

  const getByLocal = (localName: string): Element | null => {
    return getAllByLocal(localName)[0] ?? null
  }

  const getText = (localName: string): string => {
    return getByLocal(localName)?.textContent?.trim() ?? ''
  }

  const header = computed<BaseHeader>(() => {
    const empty: BaseHeader = {
      inn: '', kpp: '', orgName: '', address: '',
      okpo: '', okfs: '', okopf: '', okved: '', oktmo: '',
      okei: '', period: '',
      year: yearGetter() ?? new Date().getFullYear(),
      correctionNumber: '0',
      kodNO: '',
      docDate: '',
      signerType: 'chairman',
      signerLastName: '', signerFirstName: '', signerMiddleName: '',
      signerRepDoc: '',
      signerSnils: '',
      pfrRegNumber: '',
    }

    if (!doc.value) return withRequisites(empty)

    // ФНС-формат (плоские <Документ>/<СвНП>/<НПЮЛ>/<Подписант>) — работает
    // через CSS-селектор; ЕФС-1 теги с namespace — туда заглядываем через
    // localName, в itself-значениях будут textContent.
    const h: BaseHeader = {
      inn: getAttr('НПЮЛ', 'ИННЮЛ') || getText('ИНН'),
      kpp: getAttr('НПЮЛ', 'КПП') || getText('КПП'),
      orgName: getAttr('НПЮЛ', 'НаимОрг') || getText('Наименование'),
      address: getAttr('НПЮЛ', 'АдрМН'),
      okpo: getAttr('СвНП', 'ОКПО'),
      okfs: getAttr('СвНП', 'ОКФС'),
      okopf: getAttr('СвНП', 'ОКОПФ'),
      okved: getText('КодПоОКВЭД'),
      oktmo: getAttr('СвНП', 'ОКТМО'),
      okei: getAttr('Документ', 'ОКЕИ'),
      period: getAttr('Документ', 'Период') || getText('Код'),
      year: Number(getAttr('Документ', 'ОтчетГод') || getText('Год')) || (yearGetter() ?? new Date().getFullYear()),
      correctionNumber: getAttr('Документ', 'НомКорр') || getText('НомерКорректировки') || '0',
      kodNO: getAttr('Документ', 'КодНО'),
      docDate: getAttr('Документ', 'ДатаДок'),
      signerType: getAttr('Подписант', 'ПрПодп') === '2' ? 'representative' : 'chairman',
      signerLastName: getAttr('Подписант ФИО', 'Фамилия') || getText('Фамилия'),
      signerFirstName: getAttr('Подписант ФИО', 'Имя') || getText('Имя'),
      signerMiddleName: getAttr('Подписант ФИО', 'Отчество') || getText('Отчество'),
      signerRepDoc: getAttr('Подписант СвПред', 'НаимДок'),
      signerSnils: getAttr('ПерсСвФЛ', 'СНИЛС'),
      pfrRegNumber: getText('РегНомер'),
    }
    return withRequisites(h)
  })

  function withRequisites(h: BaseHeader): BaseHeader {
    const r = requisitesGetter()
    if (!r) return h
    const get = (key: keyof IReportRequisitesView): string => {
      const f = r[key] as { value?: string | null } | undefined
      return f?.value ?? ''
    }
    return {
      ...h,
      inn: h.inn || get('inn'),
      kpp: h.kpp || get('kpp'),
      orgName: h.orgName || get('orgName'),
      address: h.address || get('address'),
      okpo: h.okpo || get('okpo'),
      okfs: h.okfs || get('okfs'),
      okopf: h.okopf || get('okopf'),
      okved: h.okved || get('okved'),
      oktmo: h.oktmo || get('oktmo'),
      signerLastName: h.signerLastName || get('signerLastName'),
      signerFirstName: h.signerFirstName || get('signerFirstName'),
      signerMiddleName: h.signerMiddleName || get('signerMiddleName'),
      signerSnils: h.signerSnils || get('signerSnils'),
      pfrRegNumber: h.pfrRegNumber || get('pfrRegNumber'),
    }
  }

  function padInn(inn: string): { idx: number; val: string }[] {
    const chars = (inn || '').split('').slice(0, 12)
    const out: { idx: number; val: string }[] = []
    for (let i = 0; i < 12; i++) out.push({ idx: i, val: chars[i] ?? '' })
    return out
  }

  function formatDate(s: string): string {
    if (!s) return ''
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (m) return `${m[3]}.${m[2]}.${m[1]}`
    return s
  }

  function fmt(n?: number): string {
    if (n == null || n === 0) return '—'
    return new Intl.NumberFormat('ru-RU').format(n)
  }

  function fmtZero(n?: number): string {
    if (n == null) return '—'
    return new Intl.NumberFormat('ru-RU').format(n)
  }

  return { doc, header, getAttr, getNum, getByLocal, getAllByLocal, getText, padInn, formatDate, fmt, fmtZero }
}
