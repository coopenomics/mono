import * as WalletAgreement from './1.WalletAgreement'
import * as RegulationElectronicSignaturet from './2.RegulationElectronicSignature'
import * as PrivacyPolicy from './3.PrivacyPolicy'
import * as UserAgreement from './4.UserAgreement'
import * as CoopenomicsAgreement from './50.CoopenomicsAgreement'
import * as ConvertToAxonStatement from './51.ConvertToAxonStatement'
import * as ParticipantApplication from './100.ParticipantApplication'
import * as DecisionOfParticipantApplication from './501.DecisionOfParticipantApplication'
import * as SelectBranchStatement from './101.SelectBranchStatement'
import * as ProjectFreeDecision from './599.ProjectFreeDecision'
import * as FreeDecision from './600.FreeDecision'
import * as AssetContributionStatement from './700.assetContributionStatement'
import * as ReturnByAssetStatement from './800.returnByAssetStatement'
import * as AssetContributionDecision from './701.assetContributionDecision'
import * as ReturnByAssetDecision from './801.returnByAssetDecision'

import * as AssetContributionAct from './702.assetContributionAct'
import * as ReturnByAssetAct from './802.returnByAssetAct'
import * as ReturnByMoney from './900.returnByMoney'
import * as ReturnByMoneyDecision from './901.ReturnByMoneyDecision'
import * as GenerationContract from './1001.GenerationContract'
import * as ProjectGenerationContract from './1002.ProjectGenerationContract'
import * as ComponentGenerationContract from './1003.ComponentGenerationContract'
import * as StorageAgreement from './1004.StorageAgreement'
import * as BlagorostAgreement from './1007.BlagorostAgreement'
import * as InitProjectStatement from './1005.InitProjectStatement'
import * as InitProjectDecision from './1006.InitProjectDecision'

import * as ExpenseStatement from './1010.ExpenseStatement'
import * as ExpenseDecision from './1011.ExpenseDecision'

import * as ExpenseProposalStatement from './2010.ExpenseProposalStatement'
import * as ExpenseProposalDecision from './2011.ExpenseProposalDecision'

import * as GenerationMoneyInvestStatement from './1020.GenerationMoneyInvestStatement'
import * as GenerationMoneyReturnUnusedStatement from './1025.GenerationMoneyReturnUnusedStatement'

import * as CapitalizationMoneyInvestStatement from './1030.CapitalizationMoneyInvestStatement'

import * as ResultContributionStatement from './1040.ResultContributionStatement'
import * as ResultContributionDecision from './1041.ResultContributionDecision'
import * as ResultContributionAct from './1042.ResultContributionAct'

import * as GetLoanStatement from './1050.GetLoanStatement'
import * as GetLoanDecision from './1051.GetLoanDecision'

import * as GenerationPropertyInvestStatement from './1060.GenerationPropertyInvestStatement'
import * as GenerationPropertyInvestDecision from './1061.GenerationPropertyInvestDecision'
import * as GenerationPropertyInvestAct from './1062.GenerationPropertyInvestAct'

import * as CapitalizationPropertyInvestStatement from './1070.CapitalizationPropertyInvestStatement'
import * as CapitalizationPropertyInvestDecision from './1071.CapitalizationPropertyInvestDecision'
import * as CapitalizationPropertyInvestAct from './1072.CapitalizationPropertyInvestAct'

import * as GenerationConvertStatement from './1080.GenerationConvertStatement'

import * as CapitalizationToMainWalletConvertStatement from './1090.CapitalizationToMainWalletConvertStatement'

import * as SosediAgreement from './699.SosediAgreement'

import * as AnnualGeneralMeetingAgenda from './300.AnnualGeneralMeetingAgenda'
import * as AnnualGeneralMeetingSovietDecision from './301.AnnualGeneralMeetingSovietDecision'
import * as AnnualGeneralMeetingNotification from './302.AnnualGeneralMeetingNotification'
import * as AnnualGeneralMeetingVotingBallot from './303.AnnualGeneralMeetingVotingBallot'
import * as AnnualGeneralMeetingDecision from './304.AnnualGeneralMeetingDecision'

import * as BlagorostProgramTemplate from './998.BlagorostProgramTemplate'
import * as BlagorostOfferTemplate from './999.BlagorostOfferTemplate'
import * as GenerationContractTemplate from './997.GenerationContractTemplate'
import * as GeneratorOfferTemplate from './995.GeneratorOfferTemplate'
import * as GeneratorOffer from './996.GeneratorOffer'
import * as GeneratorProgramTemplate from './994.GeneratorProgramTemplate'
import * as BlagorostOffer from './1000.BlagorostOffer'

export const Registry = {
  1: WalletAgreement,
  2: RegulationElectronicSignaturet,
  3: PrivacyPolicy,
  4: UserAgreement,
  50: CoopenomicsAgreement,
  51: ConvertToAxonStatement,
  100: ParticipantApplication,
  101: SelectBranchStatement,
  300: AnnualGeneralMeetingAgenda,
  301: AnnualGeneralMeetingSovietDecision,
  302: AnnualGeneralMeetingNotification,
  303: AnnualGeneralMeetingVotingBallot,
  304: AnnualGeneralMeetingDecision,
  501: DecisionOfParticipantApplication,
  599: ProjectFreeDecision,
  600: FreeDecision,
  699: SosediAgreement,
  700: AssetContributionStatement,
  701: AssetContributionDecision,
  702: AssetContributionAct,
  800: ReturnByAssetStatement,
  801: ReturnByAssetDecision,
  802: ReturnByAssetAct,
  900: ReturnByMoney,
  901: ReturnByMoneyDecision,
  994: GeneratorProgramTemplate,
  995: GeneratorOfferTemplate,
  996: GeneratorOffer,
  997: GenerationContractTemplate,
  998: BlagorostProgramTemplate,
  999: BlagorostOfferTemplate,
  1000: BlagorostOffer,
  1001: GenerationContract,
  1002: ProjectGenerationContract,
  1003: ComponentGenerationContract,
  1004: StorageAgreement,
  1007: BlagorostAgreement,
  1005: InitProjectStatement,
  1006: InitProjectDecision,
  1010: ExpenseStatement,
  1011: ExpenseDecision,
  1020: GenerationMoneyInvestStatement,
  1025: GenerationMoneyReturnUnusedStatement,
  1030: CapitalizationMoneyInvestStatement,
  1040: ResultContributionStatement,
  1041: ResultContributionDecision,
  1042: ResultContributionAct,
  1050: GetLoanStatement,
  1051: GetLoanDecision,
  1060: GenerationPropertyInvestStatement,
  1061: GenerationPropertyInvestDecision,
  1062: GenerationPropertyInvestAct,
  1070: CapitalizationPropertyInvestStatement,
  1071: CapitalizationPropertyInvestDecision,
  1072: CapitalizationPropertyInvestAct,
  1080: GenerationConvertStatement,
  1090: CapitalizationToMainWalletConvertStatement,
  2010: ExpenseProposalStatement,
  2011: ExpenseProposalDecision,
}
