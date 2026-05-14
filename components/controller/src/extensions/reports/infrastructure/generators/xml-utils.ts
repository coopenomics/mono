import { randomUUID } from 'crypto';
import { create } from 'xmlbuilder2';
import type { ReportInput } from '../../domain/interfaces/report-generator.interface';
import type { ZeroReportSignerShape } from '../../domain/edits-shapes/zero-report-edits.shape';

export function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function createXmlDoc(): any {
  return create({ version: '1.0', encoding: 'windows-1251' });
}

/**
 * Сгенерировать имя файла отчётности ФНС по единому формату эталона:
 *   <prefix>_<tax>_<tax>_<inn><kpp>_<YYYYMMDD>_<uuid>
 * где `tax` — первые 4 цифры КПП, `inn<kpp>` — конкатенация без разделителя.
 */
export function generateFnsFileName(prefix: string, input: ReportInput): string {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const tax = getTaxOfficeCode(input.kpp);
  const unit = `${input.inn}${input.kpp}`;
  return `${prefix}_${tax}_${tax}_${unit}_${dateStr}_${randomUUID()}`;
}

export function addFio(
  parent: any,
  fio: { lastName: string; firstName: string; middleName?: string },
): any {
  const el = parent.ele('ФИО')
    .att('Фамилия', fio.lastName)
    .att('Имя', fio.firstName);
  if (fio.middleName) {
    el.att('Отчество', fio.middleName);
  }
  return el.up();
}

/**
 * Базовый <Подписант ПрПодп="1"> без доверенности — для случаев,
 * когда отчёт подписывает сам руководитель.
 */
export function addSigner(
  parent: any,
  fio: { lastName: string; firstName: string; middleName?: string },
): any {
  const signer = parent.ele('Подписант').att('ПрПодп', '1');
  addFio(signer, fio);
  return signer.up();
}

/**
 * Универсальный блок <Подписант> с поддержкой представителя.
 * - chairman → ПрПодп="1", только <ФИО>.
 * - representative → ПрПодп="2", <ФИО> + <СвПред НаимДок="...">,
 *   опционально с <СвПред НаимОрг="..."> для отчётов, где это требуется (РСВ).
 */
export function addFlexibleSigner(
  parent: any,
  input: ReportInput,
  options?: { svPredNaimOrg?: boolean },
): any {
  const type = input.signerType ?? 'chairman';
  const prPodp = type === 'representative' ? '2' : '1';
  const signer = parent.ele('Подписант').att('ПрПодп', prPodp);
  addFio(signer, input.signerFio);
  if (type === 'representative') {
    const svPred = signer.ele('СвПред').att('НаимДок', input.signerRepDoc ?? '');
    if (options?.svPredNaimOrg) {
      svPred.att('НаимОрг', input.orgName);
    }
    svPred.up();
  }
  return signer.up();
}

export function getQuarterPeriodCode(quarter?: number): string {
  switch (quarter) {
    case 1: return '21';
    case 2: return '31';
    case 3: return '33';
    case 4: return '34';
    default: return '21';
  }
}

export function getMonthPeriodCode(month?: number): string {
  return month ? String(month).padStart(2, '0') : '01';
}

export function getTaxOfficeCode(kpp: string): string {
  return kpp.substring(0, 4);
}

/**
 * <Подписант ПрПодп="1|2"> для ZeroReportEditsShape.
 * `options.svPredNaimOrg` — добавить НаимОрг в <СвПред> (нужно для РСВ).
 */
export function addFlexibleSignerFromShape(
  parent: any,
  signer: ZeroReportSignerShape,
  options?: { svPredNaimOrg?: boolean; orgName?: string },
): any {
  const prPodp = signer.type === 'representative' ? '2' : '1';
  const sig = parent.ele('Подписант').att('ПрПодп', prPodp);
  const fio = sig.ele('ФИО')
    .att('Фамилия', signer.lastName)
    .att('Имя', signer.firstName);
  if (signer.middleName) fio.att('Отчество', signer.middleName);
  fio.up();
  if (signer.type === 'representative') {
    const svPred = sig.ele('СвПред').att('НаимДок', signer.repDoc ?? '');
    if (options?.svPredNaimOrg && options?.orgName) {
      svPred.att('НаимОрг', options.orgName);
    }
    svPred.up();
  }
  return sig.up();
}

export interface HeaderMeta {
  docDate: string;
  period: string;
  year: number;
  kodNO: string;
  correctionNumber: number;
  poMestu: string;
}

/** Проставить общий набор атрибутов в <Документ>. */
export function addHeaderMeta(docEl: any, meta: HeaderMeta): void {
  docEl
    .att('ДатаДок', meta.docDate)
    .att('НомКорр', String(meta.correctionNumber))
    .att('Период', meta.period)
    .att('ОтчетГод', String(meta.year))
    .att('КодНО', meta.kodNO)
    .att('ПоМесту', meta.poMestu);
}
