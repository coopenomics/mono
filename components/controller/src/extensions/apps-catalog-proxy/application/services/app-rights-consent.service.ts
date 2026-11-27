import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { TableStore } from '@coopenomics/extension-kit';
import { APP_RIGHTS_CONSENT_STORE } from '../../infrastructure/database/apps-catalog-proxy-stores';
import { AppRightsConsentRecord } from '../../infrastructure/records/app-rights-consent.record';
import { normalizeDeclaration, type AppPortDeclaration } from './app-port-grants.service';
import { AppRightsNotifierService } from './app-rights-notifier.service';

/** Согласие дал переключатель «Принимать новые права»: председатель включил его заранее. */
export const AUTO_CONSENT = 'auto';

/** Предел длины версии в запросе новых прав: semver с пометками в него укладывается. */
const VERSION_MAX = 64;

/** Чего из `want` нет в `have`. */
function minus(want: string[], have: string[]): string[] {
  const known = new Set(have);
  return want.filter((item) => !known.has(item));
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort();
}

/**
 * Согласия председателя на права ядра приложений каталога (487-37).
 *
 * Правило: ключ приложению ядро выдаёт только в пределах согласия. Версия,
 * которая просит больше, ключа не получает — оркестратор оставляет прежнюю
 * версию работать, а запрос новых прав ждёт ответа председателя. Отказ и
 * отложенное решение ничего не ломают: приложение работает на прежней версии.
 *
 * Новое право — только новый порт ядра или новое действие цепи: новые методы
 * разрешённого порта и правки кода согласия не требуют.
 */
@Injectable()
export class AppRightsConsentService {
  private readonly logger = new Logger(AppRightsConsentService.name);

  constructor(
    @Inject(APP_RIGHTS_CONSENT_STORE) private readonly store: TableStore<AppRightsConsentRecord>,
    @Optional() private readonly notifier?: AppRightsNotifierService,
  ) {}

  /** Согласие и запрос новых прав пакета; `null` — согласия по пакету не было. */
  async byPackage(packageId: string): Promise<AppRightsConsentRecord | null> {
    return this.store.findOne({ packageId });
  }

  /**
   * Пакеты, у которых запрос новых прав ждёт ответа. Таблица — строка на
   * установленное приложение узла, поэтому читается целиком.
   */
  async pendingPackageIds(): Promise<Set<string>> {
    const rows = await this.store.find({});
    return new Set(rows.filter((row) => row.pendingVersion !== null).map((row) => row.packageId));
  }

  /**
   * Допустить ли выдачу ключа версии с такими правами.
   *
   * @returns `true` — права укладываются в согласие либо приняты переключателем;
   *   `false` — версия просит больше, запрос записан и ждёт председателя.
   */
  async admit(packageId: string, declared: AppPortDeclaration, version: string): Promise<boolean> {
    const want = normalizeDeclaration(declared);
    const row = await this.store.findOne({ packageId });
    const missing = {
      ports: minus(want.ports, row?.ports ?? []),
      chainActions: minus(want.chainActions, row?.chainActions ?? []),
    };
    if (missing.ports.length === 0 && missing.chainActions.length === 0) {
      // Версия просит не больше согласованного: прежний запрос новых прав устарел.
      if (row?.pendingVersion) await this.store.update({ packageId }, { ...this.noPending(), updatedAt: new Date() });
      return true;
    }
    if (row?.autoAccept) {
      await this.accept(row, missing, AUTO_CONSENT);
      this.logger.log(`права ${packageId} расширены переключателем: ${[...missing.ports, ...missing.chainActions].join(', ')}`);
      return true;
    }
    await this.remember(packageId, row, missing, version);
    return false;
  }

  /**
   * Председатель согласился с правами: они добавляются к согласованным, а
   * запрос новых прав теряет то, на что ответ дан.
   */
  async grant(packageId: string, rights: AppPortDeclaration, username: string): Promise<AppRightsConsentRecord> {
    const given = normalizeDeclaration(rights);
    const row = await this.store.findOne({ packageId });
    if (row) return this.accept(row, given, username);
    const now = new Date();
    return this.store.insert({
      packageId,
      ports: given.ports,
      chainActions: given.chainActions,
      autoAccept: false,
      consentedBy: username,
      consentedAt: now,
      ...this.noPending(),
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Переключатель «Принимать новые права после одобрения модератора каталога».
   * Включение сразу принимает запрос, который уже ждёт: иначе председатель
   * включил бы переключатель, а обновление продолжало бы стоять.
   */
  async setAutoAccept(packageId: string, enabled: boolean, username: string): Promise<AppRightsConsentRecord> {
    const row = await this.store.findOne({ packageId });
    const now = new Date();
    if (!row) {
      return this.store.insert({
        packageId,
        ports: [],
        chainActions: [],
        autoAccept: enabled,
        consentedBy: null,
        consentedAt: null,
        ...this.noPending(),
        createdAt: now,
        updatedAt: now,
      });
    }
    await this.store.update({ packageId }, { autoAccept: enabled, updatedAt: now });
    const fresh = { ...row, autoAccept: enabled };
    if (!enabled || fresh.pendingVersion === null) return fresh;
    return this.accept(fresh, { ports: fresh.pendingPorts, chainActions: fresh.pendingChainActions }, username);
  }

  /** Стереть согласие пакета: подписка отменена, при новой подписке председатель отвечает заново. */
  async forget(packageId: string): Promise<void> {
    await this.store.delete({ packageId });
  }

  /** Добавить права к согласованным и убрать их из запроса новых прав. */
  private async accept(row: AppRightsConsentRecord, rights: AppPortDeclaration, by: string): Promise<AppRightsConsentRecord> {
    const ports = union(row.ports, rights.ports);
    const chainActions = union(row.chainActions, rights.chainActions);
    const pendingPorts = minus(row.pendingPorts, ports);
    const pendingChainActions = minus(row.pendingChainActions, chainActions);
    const answered = pendingPorts.length === 0 && pendingChainActions.length === 0;
    const now = new Date();
    const patch: Partial<AppRightsConsentRecord> = {
      ports,
      chainActions,
      consentedBy: by,
      consentedAt: now,
      ...(answered ? this.noPending() : { pendingPorts, pendingChainActions }),
      updatedAt: now,
    };
    await this.store.update({ packageId: row.packageId }, patch);
    return { ...row, ...patch };
  }

  /** Записать запрос новых прав: что версия просит сверх согласия. */
  private async remember(
    packageId: string,
    row: AppRightsConsentRecord | null,
    missing: AppPortDeclaration,
    version: string,
  ): Promise<void> {
    const now = new Date();
    const pending = {
      pendingPorts: missing.ports,
      pendingChainActions: missing.chainActions,
      pendingVersion: version.slice(0, VERSION_MAX),
    };
    // Повторный запрос той же версии время запроса не сдвигает и председателя
    // вторым уведомлением не беспокоит: оркестратор повторяет установку по расписанию.
    const same = row?.pendingVersion === pending.pendingVersion;
    if (!row) {
      await this.store.insert({
        packageId,
        ports: [],
        chainActions: [],
        autoAccept: false,
        consentedBy: null,
        consentedAt: null,
        ...pending,
        pendingAt: now,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await this.store.update({ packageId }, { ...pending, pendingAt: same && row.pendingAt ? row.pendingAt : now, updatedAt: now });
    }
    if (!same) await this.notifier?.requestRaised(packageId);
  }

  private noPending(): Pick<AppRightsConsentRecord, 'pendingPorts' | 'pendingChainActions' | 'pendingVersion' | 'pendingAt'> {
    return { pendingPorts: [], pendingChainActions: [], pendingVersion: null, pendingAt: null };
  }
}
