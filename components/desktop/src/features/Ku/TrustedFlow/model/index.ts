import { ref } from 'vue';
import { Cooperative } from 'cooptypes';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import type { IKuTrustRequest } from 'src/entities/Ku/model';
import { DigitalDocument, useSignDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { api } from '../api';

export * from './types';

/**
 * Процессы приёма доверенных лиц кооперативного участка.
 * Заявка — договор о полной материальной ответственности (327) с подписью
 * заявителя; председатель участка одобряет встречной подписью на том же
 * документе (без регенерации содержимого — документ восстанавливается
 * детерминированно по сохранённой метаинформации).
 */
export function useKuTrustedFlow() {
  const system = useSystemStore();
  const session = useSessionStore();
  const { signDocument } = useSignDocument();

  const isSubmitting = ref(false);

  /** Подать заявку доверенного: договор 327 с подписью заявителя + reqtrusted */
  async function requestTrusted(input: { braname: string; chairmanFullName: string }): Promise<void> {
    isSubmitting.value = true;
    try {
      const hash = await generateUniqueHash();
      const digitalDocument = new DigitalDocument();

      await digitalDocument.generate<Cooperative.Registry.BranchLiabilityAgreement.Action>({
        registry_id: Cooperative.Registry.BranchLiabilityAgreement.registry_id,
        coopname: system.info.coopname,
        username: session.username,
        hash,
        braname: input.braname,
        chairman_full_name: input.chairmanFullName,
      });

      const application = await digitalDocument.sign<Cooperative.Registry.BranchLiabilityAgreement.Meta>(
        session.username,
      );

      await api.requestTrusted({
        coopname: system.info.coopname,
        braname: input.braname,
        username: session.username,
        hash,
        application,
      });
    } finally {
      isSubmitting.value = false;
    }
  }

  /**
   * Одобрить заявку: восстановить договор по метаинформации заявки и наложить
   * встречную подпись председателя участка (вторая подпись на том же документе).
   */
  async function approveTrusted(request: IKuTrustRequest): Promise<void> {
    isSubmitting.value = true;
    try {
      const application = request.application as {
        version: string;
        hash: string;
        doc_hash: string;
        meta_hash: string;
        meta: string;
        signatures: any[];
      } | null;

      if (!application?.meta) {
        throw new Error('Заявка не содержит договора для встречной подписи');
      }

      const meta = JSON.parse(application.meta);

      // Детерминированная регенерация того же документа по сохранённой мете
      const digitalDocument = new DigitalDocument();
      const regenerated = await digitalDocument.generate<Cooperative.Registry.BranchLiabilityAgreement.Action>(meta);

      // Встречная подпись на документе первого подписанта
      const countersigned = await signDocument(regenerated as any, session.username, 2, [
        { ...application, meta } as any,
      ]);

      await api.approveTrusted({
        coopname: system.info.coopname,
        hash: request.hash,
        countersigned: countersigned as any,
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
    requestTrusted,
    approveTrusted,
    declineTrusted,
  };
}
