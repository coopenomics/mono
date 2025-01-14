import { useInstallCooperativeStore } from 'src/entities/Installer/model'
import { api } from '../api'

export const useInstallCooperative = () => {
  const store = useInstallCooperativeStore()

  async function install() {
    if (!store.wif)
      throw new Error('Ключ не установлен')

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const soviet = store.soviet.map(({ id, type, ...rest }) => rest);

    await api.install({wif: store.wif, soviet})
  }

  return {
    install,
  }
}
