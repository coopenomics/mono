import { ref } from 'vue';
import type { Mutations } from '@coopenomics/sdk';
import { Zeus } from '@coopenomics/sdk';
import { api } from '../api';

import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { DigitalDocument } from 'src/shared/lib/document';
import type { IGeneratedDocumentOutput } from 'src/shared/lib/types/document';
import { useWalletStore } from 'src/entities/Wallet';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';

export type ICreateProgramInvestInput =
  Mutations.Capital.CreateProgramInvest.IInput['data'];
export type ICreateProgramInvestOutput =
  Mutations.Capital.CreateProgramInvest.IOutput[typeof Mutations.Capital.CreateProgramInvest.name];

/** Задержка refetch после on-chain операции: parser → PG обычно 1–3с. */
const POST_CHAIN_REFETCH_MS = 3500;

export function useCreateProgramInvest() {
  const system = useSystemStore();
  const session = useSessionStore();
  const walletStore = useWalletStore();
  const contributorStore = useContributorStore();

  const isGenerating = ref(false);
  const generationError = ref(false);

  async function createProgramInvest(
    data: ICreateProgramInvestInput,
  ): Promise<ICreateProgramInvestOutput> {
    const transaction = await api.createProgramInvest(data);
    return transaction;
  }

  async function generateProgramInvestStatement(
    amount: string,
  ): Promise<IGeneratedDocumentOutput | null> {
    try {
      isGenerating.value = true;
      generationError.value = false;

      const formattedAmount =
        parseFloat(amount).toFixed(system.info.symbols.root_govern_precision) +
        ' ' +
        system.info.symbols.root_govern_symbol;

      const data: Mutations.Capital.GenerateProgramMoneyInvestStatement.IInput['data'] = {
        coopname: system.info.coopname,
        username: session.username,
        amount: formattedAmount,
      };

      const doc = await api.generateProgramMoneyInvestStatement(data);
      return doc;
    } catch (error) {
      console.error('Ошибка при генерации заявления (программа):', error);
      generationError.value = true;
      throw error;
    } finally {
      isGenerating.value = false;
    }
  }

  async function createProgramInvestWithGeneratedStatement(
    amount: string,
  ): Promise<ICreateProgramInvestOutput> {
    let optimisticPatchId: string | null = null;

    try {
      isGenerating.value = true;

      const document = await generateProgramInvestStatement(amount);
      if (!document) {
        throw new Error('Не удалось сгенерировать заявление');
      }

      const digitalDocument = new DigitalDocument(document);
      const signedDoc = await digitalDocument.sign(session.username);

      const formattedAmount =
        parseFloat(amount).toFixed(system.info.symbols.root_govern_precision) +
        ' ' +
        system.info.symbols.root_govern_symbol;

      const investData: ICreateProgramInvestInput = {
        coopname: system.info.coopname,
        username: session.username,
        amount: formattedAmount,
        statement: signedDoc,
      };

      // Оптимистичный update: списываем с ЦК (Zeus.ProgramType.MAIN),
      // зачисляем в Благорост (Zeus.ProgramType.BLAGOROST). Обе суммы — в
      // `available`, потому что Ledger2::apply(INVEST) делает TRANSFER
      // w.wal.share → w.cap.blago: оба USER_SHARED, оба пишутся в .available
      // (см. operations.hpp:INVEST). progwallets.blocked в десктоп-картах
      // не отображается — UI читает available из L3 userwallets.
      optimisticPatchId = walletStore.applyOptimisticPatch([
        {
          username: session.username,
          program_type: Zeus.ProgramType.MAIN,
          available_delta: `-${formattedAmount}`,
        },
        {
          username: session.username,
          program_type: Zeus.ProgramType.BLAGOROST,
          available_delta: formattedAmount,
        },
      ]);

      const result = await createProgramInvest(investData);

      // Оптимистично обновим «Взносы по ролям → Инвестор» на профиле,
      // чтобы не ждать parser. Через POST_CHAIN_REFETCH_MS придёт правда.
      const self = contributorStore.self;
      if (self) {
        const prevRaw = String(self.contributed_as_investor || '0').trim();
        const prevAmount = parseFloat(prevRaw.split(' ')[0] || '0') || 0;
        const addAmount = parseFloat(amount) || 0;
        const precision = system.info.symbols.root_govern_precision;
        const symbol =
          prevRaw.split(' ')[1] || system.info.symbols.root_govern_symbol;
        contributorStore.updateSelf({
          ...self,
          contributed_as_investor: `${(prevAmount + addAmount).toFixed(precision)} ${symbol}`,
        });
      }

      // НЕ ждём loadUserWallet / loadSelf синхронно: parser → PG обычно
      // отстают от блока на 1–3с. Ранний refetch вернёт стейт ДО инвеста и
      // сотрёт оптимистичный патч / покажет старые взносы. Откладываем.
      setTimeout(() => {
        void walletStore.loadUserWallet({
          coopname: system.info.coopname,
          username: session.username,
        });
        void contributorStore.loadSelf({ username: session.username });
      }, POST_CHAIN_REFETCH_MS);

      return result;
    } catch (e) {
      if (optimisticPatchId) {
        walletStore.revertOptimisticPatch(optimisticPatchId);
      }
      throw e;
    } finally {
      isGenerating.value = false;
    }
  }

  return {
    createProgramInvest,
    createProgramInvestWithGeneratedStatement,
    generateProgramInvestStatement,
    isGenerating,
    generationError,
  };
}
