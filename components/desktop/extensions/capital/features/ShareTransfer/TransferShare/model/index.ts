import { ref } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useWalletStore } from 'src/entities/Wallet';
import { DigitalDocument } from 'src/shared/lib/document';
import { shareTransferApi, useShareTransferStore } from 'app/extensions/capital/entities/ShareTransfer';

/**
 * Трансляция паевого взноса из Благороста в Цифровой Кошелёк: сервер
 * генерирует заявление (1090) на названную сумму, пайщик подписывает его
 * своим ключом, сервер отправляет действие в цепь и отвечает новым остатком.
 */
export function useTransferShare() {
  const system = useSystemStore();
  const session = useSessionStore();
  const walletStore = useWalletStore();
  const store = useShareTransferStore();
  const isSubmitting = ref(false);

  /** Сумма в виде цепи: точность и символ кооператива. */
  function chainAmount(amount: number | string): string {
    const { root_govern_precision, root_govern_symbol } = system.info.symbols;
    return `${Number(amount).toFixed(root_govern_precision)} ${root_govern_symbol}`;
  }

  async function transfer(amount: number | string): Promise<void> {
    isSubmitting.value = true;
    try {
      const asset = chainAmount(amount);
      const generated = await shareTransferApi.generateStatement({
        coopname: system.info.coopname,
        username: session.username,
        amount: asset,
      });
      const statement = await new DigitalDocument(generated).sign(session.username);
      // Сервер отвечает после разбора блока транзакции — перечитываем сразу.
      store.setState(
        await shareTransferApi.transferShare({
          coopname: system.info.coopname,
          username: session.username,
          amount: asset,
          statement,
        }),
      );
      await walletStore.loadUserWallet({ coopname: system.info.coopname, username: session.username });
    } finally {
      isSubmitting.value = false;
    }
  }

  return { transfer, isSubmitting };
}
