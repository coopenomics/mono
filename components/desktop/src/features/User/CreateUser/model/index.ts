import { api } from '../api';
import emailRegex from 'email-regex';
const emailValidator = emailRegex({ exact: true });

import { IGeneratedAccount } from 'src/shared/lib/types/user';

import { useSessionStore } from 'src/entities/Session';
import { useGlobalStore } from 'src/shared/store';
import { useSystemStore } from 'src/entities/System/model';

import type { IInitialPaymentOrder } from 'src/shared/lib/types/payments';
import { useRegistratorStore } from 'src/entities/Registrator';
import { useRegistrationStore } from 'src/entities/Registration';
import {
  IEntrepreneurData,
  IIndividualData,
  IOrganizationData,
  IUserData,
  type IRegisterAccount,
} from 'src/shared/lib/types/user/IUserData';
import { client } from 'src/shared/api/client';
import { Mutations, Zeus } from '@coopenomics/sdk';
import { DigitalDocument } from 'src/shared/lib/document';
import { IDocument } from 'src/shared/lib/types/document';
import { useAccountStore } from 'src/entities/Account/model';
import { LocalStorage } from 'quasar';
import { stripLegacyBankKpp } from 'src/shared/lib/utils/stripLegacyBankKpp';

export interface ICreateUser {
  email: string;
  entrepreneur_data?: IEntrepreneurData;
  individual_data?: IIndividualData;
  organization_data?: IOrganizationData;
  public_key: string;
  referer?: string;
  role: 'user';
  type: 'individual' | 'entrepreneur' | 'organization';
  username: string;
}

export type ISendStatement =
  Mutations.Participants.RegisterParticipant.IInput['data'];
export type ISendStatementResult =
  Mutations.Participants.RegisterParticipant.IOutput[typeof Mutations.Participants.RegisterParticipant.name];

export function useCreateUser() {
  const registratorStore = useRegistratorStore();
  const registrationStore = useRegistrationStore();
  const store = registratorStore.state;
  const { info } = useSystemStore();

  async function createInitialPayment(): Promise<IInitialPaymentOrder> {
    const result = await api.createInitialPaymentOrder();
    store.payment = result;

    return result;
  }

  /**
   * Генерирует все документы регистрации с бэкенда через Registration store
   * Использует SDK для вызова generateRegistrationDocuments
   */
  async function generateAllRegistrationDocuments(programKey?: string) {

    const accountType = store.userData.type;
    if (!accountType) {
      throw new Error('Тип аккаунта не определён');
    }

    // Преобразуем строковый тип в Zeus.AccountType
    let zeusAccountType: Zeus.AccountType;
    if (accountType === Zeus.AccountType.individual) {
      zeusAccountType = Zeus.AccountType.individual;
    } else if (accountType === Zeus.AccountType.organization) {
      zeusAccountType = Zeus.AccountType.organization;
    } else if (accountType === Zeus.AccountType.entrepreneur) {
      zeusAccountType = Zeus.AccountType.entrepreneur;
    } else {
      throw new Error(`Неизвестный тип аккаунта: ${accountType}`);
    }

    // Загружаем документы через Registration store (использует SDK внутри)
    await registrationStore.loadRegistrationDocuments(
      info.coopname,
      store.account.username,
      zeusAccountType,
      programKey || undefined
    );
  }

  /**
   * Подписывает все документы регистрации
   * @param onProgress - колбэк для отображения прогресса подписи
   */
  async function signAllRegistrationDocuments(
    onProgress?: (message: string) => void,
  ): Promise<void> {
    const docs = registrationStore.registrationDocuments;

    for (const doc of docs) {
      if (onProgress) {
        onProgress(`Подписываем ${doc.title}`);
      }

      const digitalDocument = new DigitalDocument(doc.document);
      const signedDoc = await digitalDocument.sign(store.account.username);

      registrationStore.setSignedDocument(doc.id, signedDoc);

      // Обновляем legacy поля для обратной совместимости
      switch (doc.id) {
        case 'wallet_agreement':
          store.walletAgreement = signedDoc;
          break;
        case 'privacy_agreement':
          store.privacyAgreement = signedDoc;
          break;
        case 'signature_agreement':
          store.signatureAgreement = signedDoc;
          break;
        case 'user_agreement':
          store.userAgreement = signedDoc;
          break;
      }
    }
  }

  async function sendStatementAndAgreements(): Promise<void> {
    // Собираем данные из Registration store
    const walletDoc = registrationStore.getDocumentById('wallet_agreement');
    const privacyDoc = registrationStore.getDocumentById('privacy_agreement');
    const signatureDoc = registrationStore.getDocumentById('signature_agreement');
    const userDoc = registrationStore.getDocumentById('user_agreement');
    const capitalizationDoc = registrationStore.getDocumentById('blagorost_offer');
    const generatorDoc = registrationStore.getDocumentById('generator_offer');
    const marketplaceDoc = registrationStore.getDocumentById('marketplace_offer');

    // Преобразуем program_key в правильный enum формат
    let programKey: Zeus.ProgramKey | undefined;
    if (registratorStore.state.selectedProgramKey) {
      const key = registratorStore.state.selectedProgramKey;
      if (key === 'CAPITALIZATION' || key === 'GENERATION' || key === 'MARKETPLACE') {
        programKey = key as Zeus.ProgramKey;
      }
    }

    const data: ISendStatement & { blagorost_offer?: IDocument; generator_offer?: IDocument; marketplace_offer?: IDocument; program_key?: Zeus.ProgramKey } = {
      username: store.account.username,
      braname: store.selectedBranch,
      statement: store.statement,
      wallet_agreement: walletDoc?.signed_document || store.walletAgreement,
      privacy_agreement: privacyDoc?.signed_document || store.privacyAgreement,
      signature_agreement: signatureDoc?.signed_document || store.signatureAgreement,
      user_agreement: userDoc?.signed_document || store.userAgreement,
      program_key: programKey,
    };

    console.log('Sending data with program_key:', data.program_key);

    // Добавляем blagorost_offer если есть
    if (capitalizationDoc?.signed_document) {
      data.blagorost_offer = capitalizationDoc.signed_document;
    }

    // Добавляем generator_offer если есть
    if (generatorDoc?.signed_document) {
      data.generator_offer = generatorDoc.signed_document;
    }

    // Добавляем marketplace_offer (ЦПП «Стол заказов») если есть
    if (marketplaceDoc?.signed_document) {
      data.marketplace_offer = marketplaceDoc.signed_document;
    }

    await api.sendStatement(data);
  }

  async function signStatement(): Promise<IDocument> {
    // Собираем ссылки из Registration store
    const links = registrationStore.getDocumentsForLinking;

    // Fallback на legacy поля если динамические документы пустые
    const linksArray =
      links.length > 0
        ? links
        : [
            store.walletAgreement.doc_hash,
            store.privacyAgreement.doc_hash,
            store.signatureAgreement.doc_hash,
            store.userAgreement.doc_hash,
          ].filter((hash) => hash);

    const variables: Mutations.Participants.GenerateParticipantApplication.IInput =
      {
        data: {
          signature: store.signature,
          skip_save: false,
          coopname: info.coopname,
          username: store.account.username,
          braname: store.selectedBranch,
          links: linksArray,
        },
      };

    const {
      [Mutations.Participants.GenerateParticipantApplication.name]: result,
    } = await client.Mutation(
      Mutations.Participants.GenerateParticipantApplication.mutation,
      { variables },
    );

    const digitalDocument = new DigitalDocument(result);
    store.statement = await digitalDocument.sign(store.account.username);

    return store.statement;
  }

  async function signPrivacyAgreement(): Promise<IDocument> {
    const variables: Mutations.Agreements.GeneratePrivacyAgreement.IInput = {
      data: {
        coopname: info.coopname,
        username: store.account.username,
      },
    };

    const { [Mutations.Agreements.GeneratePrivacyAgreement.name]: result } =
      await client.Mutation(
        Mutations.Agreements.GeneratePrivacyAgreement.mutation,
        { variables },
      );

    const digitalDocument = new DigitalDocument(result);
    store.privacyAgreement = await digitalDocument.sign(store.account.username);

    return store.privacyAgreement;
  }

  async function signSignatureAgreement(): Promise<IDocument> {
    const variables: Mutations.Agreements.GenerateSignatureAgreement.IInput = {
      data: {
        coopname: info.coopname,
        username: store.account.username,
      },
    };

    const { [Mutations.Agreements.GenerateSignatureAgreement.name]: result } =
      await client.Mutation(
        Mutations.Agreements.GenerateSignatureAgreement.mutation,
        { variables },
      );

    const digitalDocument = new DigitalDocument(result);
    store.signatureAgreement = await digitalDocument.sign(
      store.account.username,
    );

    return store.signatureAgreement;
  }

  async function signUserAgreement(): Promise<IDocument> {
    const variables: Mutations.Agreements.GenerateUserAgreement.IInput = {
      data: {
        coopname: info.coopname,
        username: store.account.username,
      },
    };

    const { [Mutations.Agreements.GenerateUserAgreement.name]: result } =
      await client.Mutation(
        Mutations.Agreements.GenerateUserAgreement.mutation,
        { variables },
      );

    const digitalDocument = new DigitalDocument(result);
    store.userAgreement = await digitalDocument.sign(store.account.username);

    return store.userAgreement;
  }

  async function signWalletAgreement(): Promise<IDocument> {
    const variables: Mutations.Agreements.GenerateWalletAgreement.IInput = {
      data: {
        coopname: info.coopname,
        username: store.account.username,
      },
    };

    const { [Mutations.Agreements.GenerateWalletAgreement.name]: result } =
      await client.Mutation(
        Mutations.Agreements.GenerateWalletAgreement.mutation,
        { variables },
      );

    const digitalDocument = new DigitalDocument(result);
    store.walletAgreement = await digitalDocument.sign(store.account.username);

    return store.walletAgreement;
  }

  async function generateStatementWithoutSignature() {
    const variables: Mutations.Participants.GenerateParticipantApplication.IInput =
      {
        data: {
          signature: '',
          skip_save: true,
          coopname: info.coopname,
          username: store.account.username,
          braname: store.selectedBranch,
        },
      };

    const {
      [Mutations.Participants.GenerateParticipantApplication.name]: result,
    } = await client.Mutation(
      Mutations.Participants.GenerateParticipantApplication.mutation,
      { variables },
    );

    return result;
  }

  async function createUser(
    email: string,
    userData: IUserData,
    generatedAccount: IGeneratedAccount,
  ): Promise<void> {
    const synthData = { type: userData.type } as any;

    if (synthData.type === Zeus.AccountType.individual) {
      synthData.individual_data = userData.individual_data;
    } else if (synthData.type === Zeus.AccountType.organization) {
      // TODO(удалить после 01.09.2026): strip устаревший «КПП банка» из persisted-localStorage
      synthData.organization_data = stripLegacyBankKpp(userData.organization_data);
    } else if (synthData.type === Zeus.AccountType.entrepreneur) {
      synthData.entrepreneur_data = stripLegacyBankKpp(userData.entrepreneur_data);
    }

    const referer = LocalStorage.getItem(`${info.coopname}:referer`) as string || undefined;

    const data: IRegisterAccount = {
      ...synthData,
      referer,
      email: userData.email || email,
      username: userData.username || generatedAccount.username,
      public_key: generatedAccount.public_key,
    };

    const { account, tokens } = await api.createUser(data);

    const globalStore = useGlobalStore();
    const sessionStore = useSessionStore();

    await globalStore.setTokens(tokens);
    await globalStore.setWif(account.username, generatedAccount.private_key);

    await sessionStore.init();

    const accountStore = useAccountStore();
    // После создания пользователя обновляем данные в сессии
    const updatedAccount = await accountStore.getAccount(account.username);
    if (updatedAccount) {
      console.log('updatedAccount: ', updatedAccount);

      sessionStore.setCurrentUserAccount(updatedAccount);
    }
  }

  function emailIsValid(email: string): boolean {
    return emailValidator.test(email);
  }

  async function emailIsExist(email: string): Promise<boolean> {
    return await api.emailIsExist(email);
  }

  function generateAccount(): IGeneratedAccount {
    const keyPair = api.generateKeys();
    const username = api.generateUsername();

    return {
      username,
      ...keyPair,
    };
  }

  return {
    emailIsValid,
    emailIsExist,
    generateAccount,
    createUser,
    generateStatementWithoutSignature,
    signStatement,
    sendStatementAndAgreements,
    createInitialPayment,
    signWalletAgreement,
    signPrivacyAgreement,
    signUserAgreement,
    signSignatureAgreement,
    // Новые методы для динамических документов
    generateAllRegistrationDocuments,
    signAllRegistrationDocuments,
  };
}
