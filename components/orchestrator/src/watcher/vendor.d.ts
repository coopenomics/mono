/**
 * Минимальные декларации для elliptic/bs58 — ровно та поверхность,
 * которой пользуется signed-request клиент. Полные @types в workspace
 * не подключены, тянуть их ради двух вызовов не стоит.
 */
declare module 'elliptic' {
  export class ec {
    constructor(curve: string);
    keyFromPrivate(priv: Uint8Array | Buffer): {
      sign(
        hash: Uint8Array | Buffer,
        opts?: { canonical?: boolean },
      ): {
        r: { toArrayLike(type: typeof Buffer, endian: 'be', length: number): Buffer };
        s: { toArrayLike(type: typeof Buffer, endian: 'be', length: number): Buffer };
        recoveryParam: number | null;
      };
    };
  }
}

declare module 'bs58' {
  const bs58: {
    encode(buf: Uint8Array | Buffer): string;
    decode(str: string): Buffer;
  };
  export default bs58;
}
