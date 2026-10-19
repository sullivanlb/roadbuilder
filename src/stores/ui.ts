import { defineStore } from 'pinia';
import { onScopeDispose, ref } from 'vue';

export type Dialog = 'new' | 'export' | 'help';

export interface Notification {
  message: string;
  error: boolean;
}

/** How long a notification stays on screen; errors stay longer. */
const NOTIFICATION_DURATION = { info: 4500, error: 9000 };

/** Open dialog and transient notifications. */
export const useUiStore = defineStore('ui', () => {
  const dialog = ref<Dialog | null>(null);
  const notification = ref<Notification | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function notify(message: string, error = false) {
    clearTimeout(timer);
    notification.value = { message, error };
    timer = setTimeout(
      () => {
        notification.value = null;
      },
      error ? NOTIFICATION_DURATION.error : NOTIFICATION_DURATION.info,
    );
  }

  onScopeDispose(() => clearTimeout(timer));

  return {
    dialog,
    notification,
    notify,
    openDialog: (next: Dialog) => {
      dialog.value = next;
    },
    closeDialog: () => {
      dialog.value = null;
    },
  };
});
