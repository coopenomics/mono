import { Inject, Injectable } from '@nestjs/common';
import { USER_CERTIFICATE_PORT, type IUserCertificatePort, type InnerUserCertificate } from '@coopenomics/innercoop';

/**
 * Как показывать пайщика человеку: физлицо и ИП — «Фамилия Имя Отчество»,
 * организация — короткое наименование. Персональные данные расширению не
 * доступны, сертификат собирает ядро (`USER_CERTIFICATE_PORT`), как у
 * наименований участников в «Столе заказов». Нет сертификата — пусто, стол
 * покажет учётное имя.
 */
@Injectable()
export class EdubridgeNamesService {
  constructor(@Inject(USER_CERTIFICATE_PORT) private readonly certificates: IUserCertificatePort) {}

  async displayName(username: string): Promise<string> {
    try {
      return EdubridgeNamesService.format(await this.certificates.getCertificateByUsername(username));
    } catch {
      return '';
    }
  }

  /** Имена пачкой — по одному запросу на уникальное учётное имя. */
  async displayNames(usernames: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(usernames)];
    const names = await Promise.all(unique.map((u) => this.displayName(u)));
    return new Map(unique.map((u, i) => [u, names[i] ?? '']));
  }

  static format(cert: InnerUserCertificate | null): string {
    if (!cert) return '';
    const person = [cert.last_name, cert.first_name, cert.middle_name]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(' ');
    return person || (cert.short_name ?? '').trim();
  }

  /** Совпадение поиска по ФИО или учётному имени, без учёта регистра. */
  static matches(search: string, username: string, displayName: string): boolean {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return username.toLowerCase().includes(q) || displayName.toLowerCase().includes(q);
  }
}
