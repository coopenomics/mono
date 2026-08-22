/**
 * Сертификат пайщика — как его подписывать в документах и показывать в
 * интерфейсе.
 *
 * У физлица это фамилия, имя и отчество, у организации — её наименование.
 * Расширение подставляет это в свои представления, а собирает сертификат ядро
 * из персональных данных, к которым расширению доступа нет.
 */
export interface InnerUserCertificate {
  username: string;
  /** Наименование организации; у физлица отсутствует. */
  short_name?: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  [key: string]: any;
}

export interface IUserCertificatePort {
  /** Сертификат по учётному имени; `null`, если пайщика нет. */
  getCertificateByUsername(username: string): Promise<InnerUserCertificate | null>;
}

export const USER_CERTIFICATE_PORT = Symbol.for('Innercoop.CorePort.UserCertificate');
