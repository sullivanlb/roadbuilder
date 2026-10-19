import { defineStore } from 'pinia';
import { ref } from 'vue';
import { setAuthor } from '../core/project/edits';
import { buildArchive } from '../export/archive';
import type { ExportFormat } from '../export/archive';
import { ExportError } from '../export/errors';
import { documentTexts, formatExportError, locale, t } from '../i18n';
import { usePlatform } from '../platform/platform';
import { useProjectStore } from './project';
import { useUiStore } from './ui';

/** The export dialog's choices and the archive being built. */
export const useExportStore = defineStore('export', () => {
  const platform = usePlatform();
  const store = useProjectStore();
  const ui = useUiStore();

  const author = ref('');
  const format = ref<ExportFormat>('assetto');
  const exporting = ref(false);

  function open() {
    store.commit();
    author.value = store.project.author;
    ui.openDialog('export');
  }

  async function run() {
    if (exporting.value || store.issues.errors.length) return;
    exporting.value = true;
    try {
      // Let the dialog show its busy state before the main thread is taken.
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (author.value.trim() !== store.project.author)
        store.edit((draft) => setAuthor(draft, author.value));
      const archive = buildArchive(store.project, format.value, documentTexts(locale.value));
      await platform.saveFile({
        name: archive.filename,
        type: 'application/zip',
        data: archive.bytes,
      });
      ui.closeDialog();
      ui.notify(
        format.value === 'assetto' ? t('toast.archiveDownloaded') : t('toast.sourcesDownloaded'),
      );
    } catch (error) {
      if (!(error instanceof ExportError)) throw error;
      ui.notify(t('toast.exportFailed', { reason: formatExportError(error) }), true);
    } finally {
      exporting.value = false;
    }
  }

  return { author, format, exporting, open, run };
});
