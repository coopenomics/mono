import type { IDocument } from '../../types/document';
import { Cooperative } from 'cooptypes';

export const fakeDocument: IDocument = {
  version: '1.0.0',
  hash: '33CBC662E606F23F332B442BAB84F2D05BD498B66EF61BC918740606B05BD565',
  doc_hash: '33CBC662E606F23F332B442BAB84F2D05BD498B66EF61BC918740606B05BD565',
  meta_hash: 'ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
  meta: {
    block_num: 1,
    coopname: 'voskhod',
    created_at: new Date().toISOString(),
    generator: 'generator',
    lang: 'ru',
    links: [],
    registry_id: Cooperative.Registry.WalletAgreement.registry_id,
    timezone: 'Europe/Moscow',
    // i18n-ignore: тестовые данные-заглушка (фикстура), не текст интерфейса
    title: 'Фейковый документ',
    username: 'tester',
    version: '1.0.0',
  },
  signatures: [{
    id: 1,
    signed_hash: '33CBC662E606F23F332B442BAB84F2D05BD498B66EF61BC918740606B05BD565',
    signer: 'tester',
    public_key: 'PUB_K1_8YWRWjCdUQubPoHzT5ndvfhGKDf1ZL7v7Ge9iHoLtNp7wnVfG1',
    signature: 'SIG_K1_KWeGQ48n78ybpkuVDf1M7nuGnT8pkPXFbYYMUXtFTFv2dEReMEmwW89r19dKmAVSFZwHTdxdqkB3ZQJeAS9CcQwb92E398',
    signed_at: new Date().toISOString(),
    meta: ''
  }]
};