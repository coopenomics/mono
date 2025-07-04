/* eslint-disable */

declare namespace NodeJS {
  interface ProcessEnv {
    SERVICE_WORKER_FILE: string;
    PWA_FALLBACK_HTML: string;
    NODE_ENV: string;
    BACKEND_URL: string;
    CHAIN_URL: string;
    CHAIN_ID: string;
    CURRENCY: string;
    COOP_SHORT_NAME: string;
    SITE_DESCRIPTION: string;
    SITE_IMAGE: string;
    STORAGE_URL: string;
    UPLOAD_URL: string;
    TIMEZONE: string;
    VUE_ROUTER_MODE: string;
    VUE_ROUTER_BASE: string;
    NOVU_APP_ID: string;
    NOVU_BACKEND_URL: string;
    NOVU_SOCKET_URL: string;
  }
}
