import { t } from 'src/shared/i18n';

/**
 * Права ядра приложения каталога строками перечня: название права, что оно
 * даёт приложению, имя из манифеста. Один перечень на согласие председателя
 * при установке и на модерацию выпуска: оба читают права одними словами.
 */
export interface CoreRightLine {
  key: string;
  title: string;
  text: string;
  /** Имя порта либо действие цепи `contract::action` — как в манифесте приложения. */
  code: string;
  /** Порт вне перечня ядра: такой вызов ядро отклоняет. */
  unknown: boolean;
}

/** Порты ядра, открытые приложениям каталога. */
const PORTS = ['document', 'cooperativeVars', 'accessToken', 'account', 'chain'] as const;
type KnownPort = (typeof PORTS)[number];

const isKnownPort = (port: string): port is KnownPort => (PORTS as readonly string[]).includes(port);

/** Перечень прав: сначала порты, затем действия цепи. */
export function coreRightLines(ports: string[], chainActions: string[]): CoreRightLine[] {
  const portLines = ports.map((port) => {
    const known = isKnownPort(port);
    return {
      key: `port:${port}`,
      title: known ? t(`catalogApp.rights.port.${port}`) : port,
      text: known ? t(`catalogApp.rights.portText.${port}`) : t('catalogApp.rights.unknownText'),
      code: port,
      unknown: !known,
    };
  });
  const actionLines = chainActions.map((action) => ({
    key: `action:${action}`,
    title: t('catalogApp.rights.chainAction'),
    text: t('catalogApp.rights.chainActionText'),
    code: action,
    unknown: false,
  }));
  return [...portLines, ...actionLines];
}
