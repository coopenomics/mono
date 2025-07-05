import { Notify } from 'quasar';
import { extractGraphQLErrorMessages } from './errors';

export function SuccessAlert(message: string): void {
  Notify.create({
    message,
    color: 'primary',
    position: 'center',
    actions: [
      {
        icon: 'close',
        color: 'white',
        round: true,
        size: 'sm',
        flat: true,
        handler: () => {
          /* ... */
        },
      },
    ],
  });
}

export function FailAlert(error: any): void {
  const message = extractGraphQLErrorMessages(error);
  Notify.create({
    message,
    type: 'negative',
    position: 'top-right',
    actions: [
      {
        icon: 'close',
        color: 'white',
        round: true,
        size: 'sm',
        flat: true,
        handler: () => {
          /* ... */
        },
      },
    ],
  });
}

export function NotifyAlert(
  title: string,
  body?: string,
  avatar?: string,
): void {
  Notify.create({
    message: title,
    caption: body,
    avatar: avatar,
    position: 'top-right',
    timeout: 8000,
    actions: [
      {
        icon: 'close',
        round: true,
        size: 'sm',
        flat: true,
        handler: () => {
          /* ... */
        },
      },
    ],
  });
}
