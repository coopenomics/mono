export {};

declare global {
  interface Error {
    statusCode?: number;
    subcode?: number;
  }
}

