import { loadSceneryImages } from '../assets/scenery';
import type { Project } from '../core/project/schema';
import { buildArchive } from '../export/archive';
import type { ExportFormat } from '../export/archive';
import { ExportError } from '../export/errors';
import type { ExportErrorDetail } from '../export/errors';
import { documentTexts } from '../i18n';
import type { Locale } from '../i18n';

/**
 * Outcome of an export. Typed errors do not survive the trip back from a
 * worker, so a refused export is a value rather than an exception.
 */
export type ExportResult =
  { ok: true; filename: string; bytes: Uint8Array } | { ok: false; detail: ExportErrorDetail };

/** Builds the archive with its documents in the given language, and the textures it needs. */
export async function runExport(
  project: Project,
  format: ExportFormat,
  locale: Locale,
): Promise<ExportResult> {
  try {
    // The roadway always takes images, scenery or not.
    const images = await loadSceneryImages();
    const archive = buildArchive(project, format, documentTexts(locale), images);
    return { ok: true, filename: archive.filename, bytes: archive.bytes };
  } catch (error) {
    if (error instanceof ExportError) return { ok: false, detail: error.detail };
    throw error;
  }
}
