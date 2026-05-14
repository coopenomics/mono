import { defineStore } from 'pinia';
import { api } from '../api'
import { Ref, ref } from 'vue';
import type { DraftContract, SovietContract } from 'cooptypes';
import type { IGeneratedDocument } from 'src/shared/lib/document';
import type { IPaginatedAgreementsResponse, ILoadPaginatedAgreementsInput } from './types';

const namespace = 'agreementer';

interface IAgreementStore {
  /*  доменный интерфейс кошелька пользователя */
  agreementsTemplates: Ref<DraftContract.Tables.Drafts.IDraft[]>
  cooperativeAgreements: Ref<SovietContract.Tables.CoopAgreements.ICoopAgreement[]>;
  generatedAgreements: Ref<IGeneratedDocument[]>
  paginatedAgreements: Ref<IPaginatedAgreementsResponse | null>;
  loadAgreementTemplates: (coopname: string) => Promise<void>;
  loadCooperativeAgreements: (coopname: string) => Promise<void>;
  loadPaginatedAgreements: (data: ILoadPaginatedAgreementsInput) => Promise<void>;
}

export const useAgreementStore = defineStore(namespace, (): IAgreementStore => {
  const agreementsTemplates = ref<DraftContract.Tables.Drafts.IDraft[]>([]);

  const cooperativeAgreements = ref<SovietContract.Tables.CoopAgreements.ICoopAgreement[]>([]);

  const generatedAgreements = ref<IGeneratedDocument[]>([])

  const paginatedAgreements = ref<IPaginatedAgreementsResponse | null>(null)

  const loadAgreementTemplates = async (coopname: string) => {
    agreementsTemplates.value = await api.loadAgreementTemplates(coopname)
  }

  const loadCooperativeAgreements = async (coopname: string) => {
    cooperativeAgreements.value = await api.loadCooperativeAgreements(coopname)
  }

  const loadPaginatedAgreements = async (data: ILoadPaginatedAgreementsInput) => {
    paginatedAgreements.value = await api.loadPaginatedAgreements(data)
  }

  return {
    cooperativeAgreements,
    agreementsTemplates,
    loadAgreementTemplates,
    loadCooperativeAgreements,
    generatedAgreements,
    paginatedAgreements,
    loadPaginatedAgreements
  };
});
