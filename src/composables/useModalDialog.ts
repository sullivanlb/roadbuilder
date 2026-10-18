import { onBeforeUnmount, ref, watch } from 'vue';
import type { Ref } from 'vue';

/** Keeps a native <dialog> element in sync with an open flag and closes it on unmount. */
export function useModalDialog(open: () => boolean): Ref<HTMLDialogElement | null> {
  const dialog = ref<HTMLDialogElement | null>(null);
  watch(
    open,
    (active) => {
      const el = dialog.value;
      if (!el) return;
      if (active) {
        if (!el.open) el.showModal();
      } else if (el.open) el.close();
    },
    { flush: 'post' },
  );
  onBeforeUnmount(() => dialog.value?.close());
  return dialog;
}
