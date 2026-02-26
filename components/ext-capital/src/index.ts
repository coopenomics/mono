import type { IExtensionModule, IExtensionMetadata, IExtensionFrontendManifest } from '@coopenomics/interops';
import { CapitalPluginModule, CapitalPlugin, Schema } from './capital-extension.module';

const metadata: IExtensionMetadata = {
  name: 'capital',
  version: '0.1.0',
  title: 'Благорост',
  description: 'Управление интеллектуальными и имущественными вкладами по целевой программе "Благорост"',
  icon: 'fa-solid fa-seedling',
  image: 'https://i.ibb.co/HRW1nFY/Chat-GPT-Image-10-2025-20-40-57.png',
  tags: ['стол', 'управление'],
  requiresLicense: false,
  isBuiltin: false,
  desktops: [
    {
      name: 'capital',
      title: 'Стол благороста',
      icon: 'fa-solid fa-seedling',
      defaultRoute: 'capital-wallet',
    },
  ],
};

const capitalExtension: IExtensionModule = {
  getMetadata() {
    return metadata;
  },

  getBackendModule() {
    return CapitalPluginModule;
  },

  getFrontendManifest(): IExtensionFrontendManifest {
    return {
      installPath: '@coopenomics/ext-capital/desktop/install',
    };
  },

  getConfigSchema() {
    return Schema;
  },

  getPluginClass() {
    return CapitalPlugin;
  },
};

export default capitalExtension;
export { CapitalPluginModule, CapitalPlugin, Schema };
