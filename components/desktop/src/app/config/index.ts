import { t } from 'src/shared/i18n';
const coreHost = 'voskhod' //urtrzvfscntv

export default {
  production: false,
  mobileMenuEnabled: false,
  headerEnabled: true,
  backend: 'http://127.0.0.1:2998', //http://127.0.0.1:3000 //2999 https://testnet1.copenomics.world/api
  gitHub: 'https://google.com',
  gitBook: 'https://yandex.ru',
  botName: 'dacom',
  header: { title: 'DACom' },
  siteTitle: 'DACom | DEXCOOP',
  siteDescription: t('app.config.siteDescription'),
  siteImage: '/assets/preview.png',
  allowedNftCreatingAccounts: ['nfttest'],
  tiledeskProject: '6460c2ab3e07dc00195ccbf6',
  admin: coreHost,
  coreHost: coreHost,
  coreSymbol: 'AXON',
  corePrecision: 4,
  dsn: 'https://b8151ac0239b44339e0e8c65c9aa59c4@o245142.ingest.sentry.io/5739100',
  chains: [
    {
      name: 'INTELLECT',
      rpcEndpoints: [
        {
          protocol: 'http',
          host: '127.0.0.1',
          port: 8888,
        },
      ],
      explorerApiUrl: 'https://hyperion.copenomics.world', //http://127.0.0.1:6999
      wallets: [
        // {
        //   contract: 'eosio.token',
        //   symbol: 'AXON',
        //   canTransfer: true,
        //   canDeposit: true,
        //   canWithdraw: true,
        //   canChange: true,
        //   p2pMode: false,
        // },
        // {
        //   contract: 'testtoken',
        //   symbol: 'RUB',
        //   canTransfer: false,
        //   canDeposit: true,
        //   canWithdraw: true,
        //   canChange: true,
        //   p2pMode: false,
        // },
      ],
      coreSymbol: 'AXON',
    },
  ],
  ual: {
    rootChain: 'INTELLECT',
  },
  tableCodeConfig: {
    core: 'unicore',
    secret: 'secret',
    staker: 'staker',
    p2p: 'p2p',
    reg: 'regtest1', //reg.test
    part: 'part',
    nft: 'nft',
    withdrawer: 'withdrawer',
    sovet: 'sovettest1',
    draft: 'drafttest1',
    //TODO
    market: 'markettest1',
    soviet: 'soviettest1',
  },

  //TODO
  components: [
    {
      name: 'auth',
      start_route: 'signup',
      params: {
        coopname: coreHost,
      },
    },
    {
      name: 'registrator',
      start_route: 'sign-up',
      params: {
        coopname: coreHost,
      },
    },
    { name: 'wallet', params: {} },
    {
      name: 'market',
      params: {
        coopname: coreHost,
      },
    },
    { name: 'drafter', params: {} },
    { name: 'explorer', params: {} },
    {
      name: 'soviet',
      params: {
        coopname: coreHost,
      },
    },
    // {name: 'assistant', start_route: 'assistant-choice', params: {
    //     coopname: coreHost
    // }},
  ],

  registrator: {
    appName: 'UniUI',
    api: 'http://127.0.0.1:2998', //https://testnet1.copenomics.world/api
    showInIndexHeader: true,
    showInOtherHeader: false,
    coopname: coreHost,

    //TODO INSERT IT!
    showRegisterButton: true,
  },
  paymentUrl: 'http://127.0.0.1:5011',
  storageUrl: 'https://testnet1.copenomics.world/uploaded/',
  uploadUrl: 'https://storage.copenomics.world/upload',
  homePageWithoutAuth: 'auth', //market
  homePageWithAuth: 'wallet',
  userMenu: [
    // {
    //   path: '/wallet',
    //   name: 'wallet',
    //   pageName: 'Кошелёк',
    //   icon: 'fa-solid fa-wallet',
    //   isMobile: true,
    // },
    {
      path: '/marketplace',
      name: 'marketplace',
      pageName: t('app.config.pageMarket'),
      icon: 'fa-solid fa-barcode',
      isMobile: true,
    },
    // {
    //   path: '/sellers',
    //   name: 'sellers',
    //   pageName: 'Поставщикам',
    //   icon: 'fa-solid fa-barcode',
    //   isMobile: true,
    // },
    {
      path: '/drafter',
      name: 'drafter',
      pageName: t('app.config.pageDrafter'),
      icon: 'fa-solid fa-barcode',
      isMobile: true,
    },
    {
      path: 'explorer',
      name: 'explorer',
      pageName: t('app.config.pageExplorer'),
      icon: 'fa-solid fa-cube',
    },
    // {
    //   url: 'https://google.com',
    //   name: "github",
    //   pageName: "Открытый код",
    //   icon: 'fa-brands fa-github',
    // },
    // {
    //   url: 'https://google.com',
    //   name: "gitbook",
    //   pageName: "Белый лист",
    //   icon: 'fa-solid fa-book',
    // }
  ],
  adminMenu: [
    {
      path: '/admin/withdrawer',
      name: 'admin-withdrawer',
      pageName: t('app.config.pageAdminWithdrawer'),
      icon: 'fa-solid fa-money-bill-transfer',
    },
    {
      path: '/admin/partners',
      name: 'admin-partners',
      pageName: t('app.config.pageAdminPartners'),
      icon: 'fa-solid fa-people-group',
    },
  ],
}
