import type { ExportError, ProjectErrorDetail, TrackIssue } from '../domain/diagnostics';
import type { DocumentTexts } from './documents';
import {
  frDocuments,
  frMessages,
  formatExportError as frFormatExportError,
  formatProjectError as frFormatProjectError,
  formatTrackIssue as frFormatTrackIssue,
} from './fr';
import {
  enDocuments,
  enMessages,
  formatExportError as enFormatExportError,
  formatProjectError as enFormatProjectError,
  formatTrackIssue as enFormatTrackIssue,
} from './en';
import type { MessageKey } from './fr';

export type { MessageKey, MessageParams } from './fr';

export type Locale = 'fr' | 'en';
export const LOCALES: readonly Locale[] = ['fr', 'en'];

/** Everything a language must provide: interface strings and message formatters. */
export interface Catalogue {
  messages: Record<MessageKey, string>;
  projectError(detail: ProjectErrorDetail): string;
  trackIssue(issue: TrackIssue): string;
  exportError(error: ExportError): string;
  documents: DocumentTexts;
}

export const catalogues: Record<Locale, Catalogue> = {
  fr: {
    messages: frMessages,
    projectError: frFormatProjectError,
    trackIssue: frFormatTrackIssue,
    exportError: frFormatExportError,
    documents: frDocuments,
  },
  en: {
    messages: enMessages,
    projectError: enFormatProjectError,
    trackIssue: enFormatTrackIssue,
    exportError: enFormatExportError,
    documents: enDocuments,
  },
};
