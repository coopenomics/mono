import { Injectable } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import config from '~/config/config';
import { DocumentInteractor } from '../interactors/document.interactor';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/**
 * Положения, которые кооператив показывает публично: их текст не зависит от
 * субъекта, поэтому документ собирается по одному лишь coopname. Список
 * закрытый — иначе через публичный запрос можно было бы собрать любой документ
 * реестра, включая те, что подставляют данные пайщика.
 */
const PUBLIC_REGISTRY_IDS: readonly number[] = [
  Cooperative.Registry.WalletAgreement.registry_id,
  Cooperative.Registry.RegulationElectronicSignature.registry_id,
  Cooperative.Registry.PrivacyPolicy.registry_id,
];

/** Сколько держим собранный текст, прежде чем снова идти в цепь. */
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedProvision {
  html: string;
  title: string;
  expires_at: number;
}

@Injectable()
export class PublicProvisionService {
  private readonly cache = new Map<number, CachedProvision>();

  constructor(private readonly documentInteractor: DocumentInteractor, private readonly logger: WinstonLoggerService) {
    this.logger.setContext(PublicProvisionService.name);
  }

  /**
   * Отдаёт текст положения ровно в том виде, в каком его собирает фабрика для
   * подписи: тот же шаблон из цепи, те же переводы, тот же движок подстановки.
   * Собирать текст на клиенте нельзя — фронт подставлял бы переменные своей
   * копией логики и расходился бы с принятой редакцией при каждом расхождении
   * версий пакета и цепи.
   */
  async getProvisionHtml(registry_id: number): Promise<{ html: string; title: string }> {
    if (!PUBLIC_REGISTRY_IDS.includes(registry_id)) {
      throw new BadRequestException(`Документ ${registry_id} не публикуется без указания субъекта`);
    }

    const cached = this.cache.get(registry_id);
    if (cached && cached.expires_at > Date.now()) {
      return { html: cached.html, title: cached.title };
    }

    const document = await this.documentInteractor.generateDocument({
      data: { coopname: config.coopname, registry_id } as any,
      // Документ показывается на экране: PDF не собираем и в базу не пишем —
      // подписывать этот экземпляр никто не будет.
      options: { skip_save: true, skip_pdf: true },
    });

    const html = document.html;
    const title = document.meta?.title ?? '';

    this.cache.set(registry_id, { html, title, expires_at: Date.now() + CACHE_TTL_MS });

    return { html, title };
  }
}
