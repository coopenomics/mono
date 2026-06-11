import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthV2Error, AuthV2ErrorCode } from '../src/errors'
import { exportFullQR } from '../src/export'
import { lockWallet } from '../src/wallet'
import { storeUnlocked } from '../src/wallet/storage'

const CERT = 'header.payload.sig'

afterEach(() => lockWallet())

function unlock(): void {
  storeUnlocked({ account: 'ant', publicKey: 'PUB_K1_ant', privateKey: '5KdummyWIF' })
}

describe('exportFullQR (Story 4.9)', () => {
  it('заперт vault → WalletLocked, consent даже не запрашивается', async () => {
    lockWallet()
    const confirm = vi.fn().mockResolvedValue(true)
    await expect(exportFullQR(CERT, { confirm })).rejects.toMatchObject({ code: AuthV2ErrorCode.WalletLocked })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('consent отклонён → ConsentRequired', async () => {
    unlock()
    await expect(exportFullQR(CERT, { confirm: async () => false })).rejects.toMatchObject({ code: AuthV2ErrorCode.ConsentRequired })
  })

  it('reject в confirm трактуется как отказ → ConsentRequired', async () => {
    unlock()
    const confirm = async (): Promise<boolean> => {
      throw new Error('dialog closed')
    }
    await expect(exportFullQR(CERT, { confirm })).rejects.toMatchObject({ code: AuthV2ErrorCode.ConsentRequired })
  })

  it('разблокирован + consent дан → payload-байты с данными сертификата', async () => {
    unlock()
    const bytes = await exportFullQR(CERT, { confirm: async () => true })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(bytes)).toBe(CERT)
  })

  it('ошибки — типизированная AuthV2Error', async () => {
    lockWallet()
    const err = await exportFullQR(CERT, { confirm: async () => true }).catch(e => e)
    expect(err).toBeInstanceOf(AuthV2Error)
  })
})
