import { ref } from 'vue';
import { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import type { IKuTrustRequest } from 'src/entities/Ku/model';
import { DigitalDocument, useSignDocument, type IGeneratedDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { api } from '../api';

export * from './types';

/**
 * Процессы приёма доверенных лиц кооперативного участка.
 * Заявка — договор о полной материальной ответственности (327) с подписью
 * заявителя; председатель участка одобряет встречной подписью на том же
 * документе: сырой документ заявителя приходит в заявке агрегатом
 * (регенерация запрещена — генерировать документ может только его автор).
 */
export function useKuTrustedFlow() {
  const system = useSystemStore();
  const session = useSessionStore();
  const { signDocument } = useSignDocument();

  const isSubmitting = ref(false);

  /**
   * Сгенерировать (без подписи) пакет документов доверенного для предпросмотра:
   * договор о полной индивидуальной материальной ответственности (327) и доверенность
   * доверенному лицу/оператору (330) — с подставленными паспортными данными заявителя.
   * Якорь процесса (hash) фиксируется здесь и переиспользуется при подписании.
   */
  async function prepareTrustedDocuments(input: { branchName: string; chairmanFullName: string }): Promise<{
    hash: string;
    application: IGeneratedDocument;
    authority: IGeneratedDocument;
  }> {
    isSubmitting.value = true;
    try {
      const hash = await generateUniqueHash();

      const application = await new DigitalDocument().generate<Cooperative.Registry.BranchTrustedLiabilityAgreement.Action>({
        registry_id: Cooperative.Registry.BranchTrustedLiabilityAgreement.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash,
        branch_name: input.branchName,
        trustee_full_name: input.chairmanFullName,
      });

      const authority = await new DigitalDocument().generate<Cooperative.Registry.BranchTrustedPowerOfAttorney.Action>({
        registry_id: Cooperative.Registry.BranchTrustedPowerOfAttorney.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash,
        branch_name: input.branchName,
        trustee_full_name: input.chairmanFullName,
      });

      return { hash, application, authority };
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Подписать предпросмотренный пакет и подать заявку доверенного (reqtrusted):
   * договор матответственности (327) и доверенность (330) с подписью заявителя.
   * Председатель участка позже накладывает встречную подпись при одобрении.
   */
  async function requestTrusted(
    input: { braname: string },
    prepared: { hash: string; application: IGeneratedDocument; authority: IGeneratedDocument },
  ): Promise<void> {
    isSubmitting.value = true;
    try {
      const application = await new DigitalDocument(prepared.application).sign<
        Cooperative.Registry.BranchTrustedLiabilityAgreement.Meta
      >(session.username);
      const authority = await new DigitalDocument(prepared.authority).sign<
        Cooperative.Registry.BranchTrustedPowerOfAttorney.Meta
      >(session.username);

      await api.requestTrusted({
        coopname: system.info.coopname,
        braname: input.braname,
        username: session.username,
        hash: prepared.hash,
        application,
        authority,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Одобрить заявку: наложить встречную подпись председателя участка на сырые
   * документы заявителя из агрегатов (вторая подпись на тех же документах) —
   * и на договор материальной ответственности, и на доверенность доверенному лицу.
   */
  async function approveTrusted(request: IKuTrustRequest): Promise<void> {
    isSubmitting.value = true;
    try {
      type RawSigned = {
        version: string;
        hash: string;
        doc_hash: string;
        meta_hash: string;
        meta: string | object;
        signatures: any[];
      };

      const rawDocument = (request as any).document?.rawDocument;
      const application = request.application as RawSigned | null;
      const rawAuthority = (request as any).authority_document?.rawDocument;
      const authority = (request as any).authority as RawSigned | null;

      if (!rawDocument || !application) {
        throw new Error('Заявка не содержит договора для встречной подписи');
      }
      if (!rawAuthority || !authority) {
        throw new Error('Заявка не содержит доверенности для встречной подписи');
      }

      const meta = typeof application.meta === 'string' ? JSON.parse(application.meta) : application.meta;
      const authorityMeta = typeof authority.meta === 'string' ? JSON.parse(authority.meta) : authority.meta;

      // Встречная подпись на документах первого подписанта — без регенерации
      const countersigned = await signDocument(rawDocument, session.username, 2, [
        { ...application, meta } as any,
      ]);
      const countersignedAuthority = await signDocument(rawAuthority, session.username, 2, [
        { ...authority, meta: authorityMeta } as any,
      ]);

      await api.approveTrusted({
        coopname: system.info.coopname,
        hash: request.hash,
        countersigned: countersigned as any,
        countersigned_authority: countersignedAuthority as any,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /** Отклонить заявку (причина — в журнал) */
  async function declineTrusted(request: IKuTrustRequest, reason: string): Promise<void> {
    isSubmitting.value = true;
    try {
      await api.declineTrusted({
        coopname: system.info.coopname,
        hash: request.hash,
        reason,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  return {
    isSubmitting,
    prepareTrustedDocuments,
    requestTrusted,
    approveTrusted,
    declineTrusted,
  };
}
