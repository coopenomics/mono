/**
 * Plain-object shape редактируемого состояния БУХОТЧ (КНД 0710096, ВерсФорм 5.04).
 *
 * Используется как единый контракт между:
 *   - `ReportEditsBuilderService.buildBuhotch()` — собирает дефолты.
 *   - `BuhotchGenerator.generate()` — сериализует в XML.
 *   - `BuhotchEditsDTO` (GraphQL @ObjectType) — зеркало для API.
 *
 * Это POJO без class-validator-декораторов — чтобы избежать runtime-зависимости
 * generator от class-transformer.
 */

export type BuhotchSignerTypeShape = 'chairman' | 'representative';

export interface BuhotchBalanceRowShape {
  /** СумОтч — в тыс. рублей, integer (totalDigits=12). */
  otch: number;
  /** СумПрдщ — за предыдущий отчётный период. */
  prev: number;
  /** СумПрдшв — за год, предшествующий предыдущему. */
  prePrev: number;
}

export interface BuhotchHeaderShape {
  /** `<Файл ИдФайл="...">` — имя файла без расширения. */
  idFile: string;
  /** `<Файл ВерсПрог="...">`. */
  programVersion: string;
  /** `<Документ ДатаДок="DD.MM.YYYY">`. */
  docDate: string;
  /** `<Документ ОтчетГод="...">`. */
  reportYear: number;
  /** `<Документ НомКорр="...">` — 0..999. */
  correctionNumber: number;
  /** `<Документ ПрАудит="0|1">`. */
  audit: boolean;
  /** `<Документ ПрУтвер="0|1">`. */
  approved: boolean;
}

export interface BuhotchOrganizationShape {
  orgName: string;
  inn: string;
  kpp: string;
  address: string | null;
  okpo: string | null;
  okfs: string;
  okopf: string;
}

export interface BuhotchSignerShape {
  type: BuhotchSignerTypeShape;
  lastName: string;
  firstName: string;
  middleName: string | null;
  /** Для type=representative — `<СвПред НаимДок="...">`. */
  repDoc: string | null;
}

export interface BuhotchBalanceShape {
  assetsTotal: BuhotchBalanceRowShape;
  nonMaterialAndLongFin: BuhotchBalanceRowShape | null;
  cash: BuhotchBalanceRowShape | null;
  shortTermFin: BuhotchBalanceRowShape | null;
  passivesTotal: BuhotchBalanceRowShape;
  targetFunds: BuhotchBalanceRowShape | null;
}

export interface BuhotchNotesShape {
  /** `<Пояснения НаимФайлПЗ="...">` — обязательное, minLength=1. */
  explanationFileName: string;
}

export interface BuhotchEditsShape {
  header: BuhotchHeaderShape;
  organization: BuhotchOrganizationShape;
  signer: BuhotchSignerShape;
  balance: BuhotchBalanceShape;
  notes: BuhotchNotesShape;
}
