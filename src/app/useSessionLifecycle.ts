import { useEventListener } from '@vueuse/core';
import { onMounted } from 'vue';
import { t } from '../i18n';
import { useFilesStore } from '../stores/files';
import { useUiStore } from '../stores/ui';

/**
 * Keeps the automatic save safe across the page lifecycle: saves when the window
 * loses focus or the page goes away, and asks before leaving when the device
 * cannot store the project.
 */
export function useSessionLifecycle() {
  const files = useFilesStore();
  const ui = useUiStore();
  useEventListener(window, 'blur', files.flush);
  useEventListener(window, 'pagehide', files.flush);
  useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
    files.flush();
    if (files.saveState === 'unavailable' || files.saveState === 'recovery') event.preventDefault();
  });
  onMounted(() => {
    if (files.restoreFailed) ui.notify(t('toast.storageUnreadable'), true);
  });
}
