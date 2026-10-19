import { defineStore } from 'pinia';
import { onScopeDispose, ref } from 'vue';
import { setAuthor } from '../core/project/edits';
import type { ExportFormat } from '../export/archive';
import { ExportError } from '../export/errors';
import { formatExportError, locale, t } from '../i18n';
import { usePlatform } from '../platform/platform';
import { createExporter } from '../workers/exporter';
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
  const exporter = createExporter();
  onScopeDispose(exporter.dispose);

  function open() {
    store.commit();
    author.value = store.project.author;
    ui.openDialog('export');
  }

  async function run() {
    if (exporting.value || store.issues.errors.length) return;
    exporting.value = true;
    try {
      if (author.value.trim() !== store.project.author)
        store.edit((draft) => setAuthor(draft, author.value));
      const result = await exporter.run(store.project, format.value, locale.value);
      if (!result.ok) {
        const reason = formatExportError(new ExportError(result.detail));
        return ui.notify(t('toast.exportFailed', { reason }), true);
      }
      await platform.saveFile({
        name: result.filename,
        type: 'application/zip',
        data: result.bytes,
      });
      ui.closeDialog();
      ui.notify(
        format.value === 'assetto' ? t('toast.archiveDownloaded') : t('toast.sourcesDownloaded'),
      );
    } finally {
      exporting.value = false;
    }
  }

  return { author, format, exporting, open, run };
});
