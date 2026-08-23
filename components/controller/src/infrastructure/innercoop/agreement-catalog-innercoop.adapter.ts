import { Inject, Injectable } from '@nestjs/common';
import type { IAgreementCatalogPort, InnerAgreementCatalogItem } from '@coopenomics/innercoop';
import { AGREEMENT_QUERY_PORT, type AgreementQueryPort } from '~/domain/registration/ports/agreement-query.port';

/**
 * Реализация `IAgreementCatalogPort`: чтение справочника оферт.
 *
 * Наружу отдана одна операция — найти оферту по идентификатору. Перечисление
 * всех оферт и подбор их под тип субъекта остаётся ядру: это его работа при
 * сборке формы вступления.
 */
@Injectable()
export class AgreementCatalogInnercoopAdapter implements IAgreementCatalogPort {
  constructor(
    @Inject(AGREEMENT_QUERY_PORT)
    private readonly agreementQueryPort: AgreementQueryPort
  ) {}

  getAgreementById(id: string): InnerAgreementCatalogItem | null {
    return this.agreementQueryPort.getAgreementById(id);
  }
}
