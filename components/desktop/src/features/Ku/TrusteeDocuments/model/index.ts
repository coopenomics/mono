import { ref } from 'vue';
import { Registry } from '@coopenomics/docs-templates';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument, type IGeneratedDocument } from 'src/shared/lib/document';
import { generateUniqueHash } from 'src/shared/lib/utils/generateUniqueHash';
import { api } from '../api';
import type { IKuTrusteeDocuments } from './types';

export * from './types';

/**
 * Документы председателя кооперативного участка после решения совета об его
 * учреждении (решение владельца 18.11.2026): доверенность на год и договор о
 * полной материальной ответственности. Председатель участка подписывает их на
 * своём участке, председатель совета — встречно через одобрения. Номер,
 * протокол совета и срок доверенности вписывает узел.
 */
/** Контекст подписи: кооператив и пайщик сессии. */
interface ISigner {
  coopname: string;
  username: string;
}

/** Доверенность для предпросмотра: реквизиты вписывает узел. */
async function generateAuthority(signer: ISigner, braname: string): Promise<IGeneratedDocument> {
  return (await api.generateTrusteePowerOfAttorney({
    ...signer,
    hash: await generateUniqueHash(),
    braname,
  })) as unknown as IGeneratedDocument;
}

/** Договор о полной материальной ответственности для предпросмотра. */
function generateLiability(signer: ISigner, branchName: string): Promise<IGeneratedDocument> {
  return generateUniqueHash().then((hash) =>
    new DigitalDocument().generate<Registry.BranchTrusteeLiabilityAgreement.Action>({
      registry_id: Registry.BranchTrusteeLiabilityAgreement.registry_id,
      ...signer,
      hash,
      branch_name: branchName,
    }),
  );
}

async function submitAuthority(signer: ISigner, braname: string, prepared: IGeneratedDocument): Promise<void> {
  const authority = await new DigitalDocument(prepared).sign<Registry.BranchTrusteePowerOfAttorney.Meta>(signer.username);
  await api.signTrusteeAuthority({ ...signer, braname, authority });
}

async function submitLiability(signer: ISigner, braname: string, prepared: IGeneratedDocument): Promise<void> {
  const liability = await new DigitalDocument(prepared).sign<Registry.BranchTrusteeLiabilityAgreement.Meta>(
    signer.username,
  );
  await api.signTrusteeLiability({ ...signer, braname, liability });
}

export function useKuTrusteeDocuments() {
  const system = useSystemStore();
  const session = useSessionStore();

  const documents = ref<IKuTrusteeDocuments | null>(null);
  const loading = ref(false);
  const isSubmitting = ref(false);

  const signer = (): ISigner => ({ coopname: system.info.coopname, username: session.username });

  /** Действие с признаком отправки: кнопка показывает загрузку, пока оно идёт. */
  async function submitting<T>(work: () => Promise<T>): Promise<T> {
    isSubmitting.value = true;
    try {
      return await work();
    } finally {
      isSubmitting.value = false;
    }
  }

  async function load(braname: string): Promise<void> {
    loading.value = true;
    try {
      documents.value = await api.getTrusteeDocuments({ ...signer(), braname });
    } finally {
      loading.value = false;
    }
  }

  return {
    documents,
    loading,
    isSubmitting,
    load,
    prepareAuthority: (braname: string) => submitting(() => generateAuthority(signer(), braname)),
    prepareLiability: (branchName: string) => submitting(() => generateLiability(signer(), branchName)),
    signAuthority: (braname: string, prepared: IGeneratedDocument) =>
      submitting(() => submitAuthority(signer(), braname, prepared)),
    signLiability: (braname: string, prepared: IGeneratedDocument) =>
      submitting(() => submitLiability(signer(), braname, prepared)),
  };
}
