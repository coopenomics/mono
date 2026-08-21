export * as WalletAgreement from './1.WalletAgreement'
export * as RegulationElectronicSignature from './2.RegulationElectronicSignature'
export * as PrivacyPolicy from './3.PrivacyPolicy'
export * as UserAgreement from './4.UserAgreement'
export * as CoopenomicsAgreement from './50.CoopenomicsAgreement'
export * as ConvertToAxonStatement from './51.ConvertToAxonStatement'
export * as ParticipantApplication from './100.ParticipantApplication'
export * as DecisionOfParticipantApplication from './501.DecisionOfParticipantApplication'
export * as ParticipantExitApplication from './200.ParticipantExitApplication'
export * as DecisionOfParticipantExit from './201.DecisionOfParticipantExit'
export * as SelectBranchStatement from './101.SelectBranchStatement'
export * as ProjectFreeDecision from './599.ProjectFreeDecision'
export * as FreeDecision from './600.FreeDecision'
export * as AssetContributionStatement from './700.assetContributionStatement'
export * as ReturnByAssetStatement from './800.returnByAssetStatement'

export * as AssetContributionDecision from './701.assetContributionDecision'
export * as ReturnByAssetDecision from './801.returnByAssetDecision'

export * as AssetContributionAct from './702.assetContributionAct'
export * as ReturnByAssetAct from './802.returnByAssetAct'
export * as ReturnByMoney from './900.returnByMoney'
export * as ReturnByMoneyDecision from './901.ReturnByMoneyDecision'

// Документы ЦПП ГЕНЕРАТОР
export * as GeneratorProgramTemplate from './994.GeneratorProgramTemplate'
export * as GeneratorOfferTemplate from './995.GeneratorOfferTemplate'
export * as GeneratorOffer from './996.GeneratorOffer'

// Документы ЦПП БЛАГОРОСТ
export * as BlagorostProgramTemplate from './998.BlagorostProgramTemplate'
export * as GenerationContractTemplate from './997.GenerationContractTemplate'
export * as BlagorostOfferTemplate from './999.BlagorostOfferTemplate'
export * as BlagorostOffer from './1000.BlagorostOffer'
export * as GenerationContract from './1001.GenerationContract'
export * as ProjectGenerationContract from './1002.ProjectGenerationContract'
export * as ComponentGenerationContract from './1003.ComponentGenerationContract'
export * as StorageAgreement from './1004.StorageAgreement'
export * as BlagorostAgreement from './1007.BlagorostAgreement'
export * as InitProjectStatement from './1005.InitProjectStatement'
export * as InitProjectDecision from './1006.InitProjectDecision'

export * as ExpenseStatement from './1010.ExpenseStatement'
export * as ExpenseDecision from './1011.ExpenseDecision'

// Шасси расходов (волна 6, MVP-SINGLE) — C28-30
export * as ExpenseProposalStatement from './2010.ExpenseProposalStatement'
export * as ExpenseProposalDecision from './2011.ExpenseProposalDecision'

export * as GenerationMoneyInvestStatement from './1020.GenerationMoneyInvestStatement'
export * as GenerationMoneyReturnUnusedStatement from './1025.GenerationMoneyReturnUnusedStatement'

export * as CapitalizationMoneyInvestStatement from './1030.CapitalizationMoneyInvestStatement'

export * as ResultContributionStatement from './1040.ResultContributionStatement'
export * as ResultContributionDecision from './1041.ResultContributionDecision'
export * as ResultContributionAct from './1042.ResultContributionAct'

export * as GetLoanStatement from './1050.GetLoanStatement'
export * as GetLoanDecision from './1051.GetLoanDecision'

export * as GenerationPropertyInvestStatement from './1060.GenerationPropertyInvestStatement'
export * as GenerationPropertyInvestDecision from './1061.GenerationPropertyInvestDecision'
export * as GenerationPropertyInvestAct from './1062.GenerationPropertyInvestAct'

export * as CapitalizationPropertyInvestStatement from './1070.CapitalizationPropertyInvestStatement'
export * as CapitalizationPropertyInvestDecision from './1071.CapitalizationPropertyInvestDecision'
export * as CapitalizationPropertyInvestAct from './1072.CapitalizationPropertyInvestAct'

export * as GenerationConvertStatement from './1080.GenerationConvertStatement'

export * as CapitalizationToMainWalletConvertStatement from './1090.CapitalizationToMainWalletConvertStatement'
export * as SosediAgreement from './699.SosediAgreement'

// Marketplace (Стол заказов) — Эпик 1 (онбординг ЦПП)
export * as MarketplaceProgramTemplate from './1100.MarketplaceProgramTemplate'
export * as MarketplaceOfferTemplate from './1101.MarketplaceOfferTemplate'
export * as MarketplaceOffer from './1102.MarketplaceOffer'

// Marketplace (Стол заказов) — Эпик 5
export * as MarketplaceTransportNote from './1103.MarketplaceTransportNote'
export * as MarketplaceAplReception from './1104.MarketplaceAplReception'
export * as MarketplaceAplIssuance from './1105.MarketplaceAplIssuance'

// Marketplace (Стол заказов) — Эпик 7: гарантийный возврат
export * as MarketplaceReturnStatement from './1106.MarketplaceReturnStatement'

// Marketplace (Стол заказов) — Эпик 8: списание скоропорта (заявление + протокол)
export * as MarketplaceWriteoffProtocol from './1107.MarketplaceWriteoffProtocol'
export * as MarketplaceWriteoffStatement from './1108.MarketplaceWriteoffStatement'
export * as BranchFinancialAidStatement from './1109.BranchFinancialAidStatement'
export * as MarketplaceConvertStatement from './1110.MarketplaceConvertStatement'
export * as MarketplaceWriteoffServiceMemo from './1111.MarketplaceWriteoffServiceMemo'
export * as BranchFinancialAidProtocol from './1112.BranchFinancialAidProtocol'

export * as AnnualGeneralMeetingAgenda from './300.AnnualGeneralMeetingAgenda'
export * as AnnualGeneralMeetingSovietDecision from './301.AnnualGeneralMeetingSovietDecision'
export * as AnnualGeneralMeetingNotification from './302.AnnualGeneralMeetingNotification'
export * as AnnualGeneralMeetingVotingBallot from './303.AnnualGeneralMeetingVotingBallot'
export * as AnnualGeneralMeetingDecision from './304.AnnualGeneralMeetingDecision'

// самоорганизация кооперативных участков
export * as BranchMeetingProposal from './320.BranchMeetingProposal'
export * as BranchMeetingBallot from './322.BranchMeetingBallot'
export * as BranchMeetingDecision from './323.BranchMeetingDecision'
export * as BranchEstablishmentPetition from './324.BranchEstablishmentPetition'
export * as BranchEstablishmentSovietDecision from './325.BranchEstablishmentSovietDecision'
export * as BranchTrustedStatement from './326.BranchTrustedStatement'
export * as BranchTrustedLiabilityAgreement from './327.BranchTrustedLiabilityAgreement'
export * as BranchTrusteeLiabilityAgreement from './328.BranchTrusteeLiabilityAgreement'
export * as BranchTrusteePowerOfAttorney from './329.BranchTrusteePowerOfAttorney'
export * as BranchTrustedPowerOfAttorney from './330.BranchTrustedPowerOfAttorney'

// Edubridge — ЦПП «Образование»
export * as EducationProgramTemplate from './3000.EducationProgramTemplate'
export * as EducationParentOfferTemplate from './3001.EducationParentOfferTemplate'
export * as EducationParentOffer from './3002.EducationParentOffer'
export * as EducationTeacherOfferTemplate from './3003.EducationTeacherOfferTemplate'
export * as EducationTeacherOffer from './3004.EducationTeacherOffer'
export * as EducationParticipationContractTemplate from './3005.EducationParticipationContractTemplate'
export * as EducationParticipationContract from './3006.EducationParticipationContract'
export * as EducationCourseAnnex from './3007.EducationCourseAnnex'
export * as EducationRidStatement from './3008.EducationRidStatement'
export * as EducationRidDecision from './3009.EducationRidDecision'
export * as EducationRidAct from './3010.EducationRidAct'
export * as EducationConvertStatement from './3011.EducationConvertStatement'

export * from './registry'
export * from './versions'
