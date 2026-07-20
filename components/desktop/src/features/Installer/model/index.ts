import type { Mutations, Queries } from '@coopenomics/sdk';
import { useInstallCooperativeStore } from 'src/entities/Installer/model'
import { stripLegacyBankKpp } from 'src/shared/lib/utils/stripLegacyBankKpp';
import { getMinSovietMembersCount } from '../lib';
import { api } from '../api'

export type IInstallInput = Mutations.System.InstallSystem.IInput['data']
export type IInstallOutput = Mutations.System.InstallSystem.IOutput[typeof Mutations.System.InstallSystem.name]

export type IStartInstallInput = Mutations.System.StartInstall.IInput['data']
export type IStartInstallOutput = Mutations.System.StartInstall.IOutput[typeof Mutations.System.StartInstall.name]

export type IGetInstallationStatusInput = Queries.System.GetInstallationStatus.IInput['data']
export type IGetInstallationStatusOutput = Queries.System.GetInstallationStatus.IOutput[typeof Queries.System.GetInstallationStatus.name]

export type IInitSystemInput = Mutations.System.InitSystem.IInput['data']
export type IInitSystemOutput = Mutations.System.InitSystem.IOutput[typeof Mutations.System.InitSystem.name]

export const useInstallCooperative = (): {
  startInstall: (wif: string) => Promise<IStartInstallOutput>
  initSystem: (data: IInitSystemInput) => Promise<IInitSystemOutput>
  getInstallationStatus: (installCode: string) => Promise<IGetInstallationStatusOutput>
  install: () => Promise<IInstallOutput>
} => {
  const store = useInstallCooperativeStore()

  async function startInstall(wif: string): Promise<IStartInstallOutput> {
    const result = await api.startInstall({ wif });
    console.log('startinstallResult', result)
    store.install_code = result.install_code;
    return result;
  }

  async function initSystem(data: IInitSystemInput): Promise<IInitSystemOutput> {
    const payload: IInitSystemInput = data.organization_data
      ? {
          ...data,
          // TODO(удалить после 01.09.2026): strip устаревший «КПП банка» из ответа getInstallationStatus
          organization_data: stripLegacyBankKpp(data.organization_data),
        }
      : data;

    return await api.initSystem(payload);
  }

  async function getInstallationStatus(installCode: string): Promise<IGetInstallationStatusOutput> {
    return await api.getInstallationStatus({ install_code: installCode });
  }

  async function install(): Promise<IInstallOutput> {
    if (!store.vars)
      throw new Error('Переменные не установлены')

    const minSovietMembers = getMinSovietMembersCount();

    if (!store.soviet || store.soviet.length < minSovietMembers) {
      throw new Error(
        minSovietMembers === 1
          ? 'Совет не установлен'
          : `Совет должен включать не менее ${minSovietMembers} человек (председатель и члены совета)`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const soviet = store.soviet.map(({ id, type, ...rest }) => rest);

    const installData: IInstallInput = {
      soviet,
      vars: store.vars
    };

    return await api.install(installData);
  }

  return {
    startInstall,
    initSystem,
    getInstallationStatus,
    install,
  }
}
