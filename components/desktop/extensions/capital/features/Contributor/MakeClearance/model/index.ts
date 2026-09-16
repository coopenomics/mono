import { ref } from 'vue';
import {
  api,
  type IMakeClearanceInput,
  type IMakeClearanceOutput,
  type IGenerateProjectGenerationContractInput,
  type IGenerateProjectGenerationContractOutput,
  type IGenerateComponentGenerationContractInput,
  type IGenerateComponentGenerationContractOutput
} from '../api';
import { signDocument } from 'src/shared/lib/document';
import { useSessionStore } from 'src/entities/Session/model';
import type { Cooperative } from 'cooptypes';
import type { IGenerateDocumentInput, IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import type { IGetProjectOutput } from 'app/extensions/capital/entities/Project/model';

export type { IMakeClearanceInput, IMakeClearanceOutput };
export type { IGenerateProjectGenerationContractInput, IGenerateProjectGenerationContractOutput };
export type { IGenerateComponentGenerationContractInput, IGenerateComponentGenerationContractOutput };
export type { IGenerateDocumentInput, IGeneratedDocumentOutput };

export function useMakeClearance() {
  const isLoading = ref(false);
  const { username } = useSessionStore();

  const makeClearance = async (
    input: IMakeClearanceInput
  ): Promise<IMakeClearanceOutput> => {
    isLoading.value = true;
    try {
      console.log('input', input)
      const result = await api.makeClearance(input);
      return result;
    } finally {
      isLoading.value = false;
    }
  };

  const generateProjectGenerationContract = async (
    input: IGenerateProjectGenerationContractInput,
    options?: Parameters<typeof api.generateProjectGenerationContract>[1]
  ): Promise<IGenerateProjectGenerationContractOutput> => {
    isLoading.value = true;
    try {
      const result = await api.generateProjectGenerationContract(input, options);
      return result;
    } finally {
      isLoading.value = false;
    }
  };

  const generateComponentGenerationContract = async (
    input: IGenerateComponentGenerationContractInput,
    options?: Parameters<typeof api.generateComponentGenerationContract>[1]
  ): Promise<IGenerateComponentGenerationContractOutput> => {
    isLoading.value = true;
    try {
      const result = await api.generateComponentGenerationContract(input, options);
      return result;
    } finally {
      isLoading.value = false;
    }
  };

  const signGeneratedDocument = async (
    document: Cooperative.Document.ZGeneratedDocument
  ): Promise<Cooperative.Document.ISignedDocument2> => {
    // Подписываем документ одинарной подписью (signatureId = 1)
    const signedDocument = await signDocument(
      document,
      username,
      1, // signatureId = 1 для одинарной подписи
    );

    return signedDocument;
  };

  const respondToInvite = async (
    project: IGetProjectOutput,
    coopname: string,
    contribution: string,
    parentProject?: IGetProjectOutput | null
  ): Promise<IMakeClearanceOutput> => {
    // Проверяем, что проект определен
    if (!project || !project.project_hash) {
      throw new Error('Проект не найден или некорректен');
    }
    isLoading.value = true;
    try {
      // Определяем, является ли проект компонентом
      const isComponent = Boolean(project.parent_hash && project.parent_hash !== '0000000000000000000000000000000000000000000000000000000000000000');

      let generatedDocument: Cooperative.Document.ZGeneratedDocument;

      if (isComponent) {
        // Генерируем документ дополнения к приложению для компонента (1003)
        if (!parentProject) {
          throw new Error('Родительский проект не найден для компонента');
        }

        const generateInput: IGenerateComponentGenerationContractInput = {
          coopname,
          username,
          component_hash: project.project_hash,
          parent_project_hash: parentProject.project_hash,
          lang: 'ru',
        };

        generatedDocument = await generateComponentGenerationContract(generateInput);
      } else {
        // Генерируем документ приложения к договору для проекта (1002)
        const generateInput: IGenerateProjectGenerationContractInput = {
          coopname,
          username,
          project_hash: project.project_hash,
          lang: 'ru',
        };

        generatedDocument = await generateProjectGenerationContract(generateInput);
      }

      // 2. Подписываем сгенерированный документ одинарной подписью
      const signedDocument = await signGeneratedDocument(generatedDocument);

      // 3. Отправляем подписанный документ
      const clearanceInput: IMakeClearanceInput = {
        project_hash: project.project_hash,
        coopname,
        username,
        document: signedDocument,
        contribution,
      };
      return await makeClearance(clearanceInput);
    } finally {
      isLoading.value = false;
    }
  };

  return {
    makeClearance,
    generateProjectGenerationContract,
    generateComponentGenerationContract,
    signGeneratedDocument,
    respondToInvite,
    isLoading,
  };
}
