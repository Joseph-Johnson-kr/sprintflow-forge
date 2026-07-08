import Papa from 'papaparse';
import type { Story } from '../types';

export interface CsvParseResult {
  stories: Story[];
  errors: string[];
  warnings: string[];
}

const KEY_FIELDS = ['issue key', 'key', 'issuekey'];
const SUMMARY_FIELDS = ['summary', 'title'];
const POINTS_FIELDS = [
  'story points',
  'storypoints',
  'custom field (story points)',
  'points',
  'sp',
];
const ROLLOVER_FIELDS = ['rollover', 'roll over', 'rolled over'];

function findField(headers: string[], candidates: string[]): string | null {
  const lowered = headers.map((h) => h.trim().toLowerCase());
  for (const cand of candidates) {
    const idx = lowered.indexOf(cand);
    if (idx >= 0) return headers[idx];
  }
  return null;
}

export function parseCsv(text: string): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const errors: string[] = [];
        const warnings: string[] = [];
        const stories: Story[] = [];

        if (result.errors.length > 0) {
          for (const e of result.errors) {
            errors.push(`Row ${e.row ?? '?'}: ${e.message}`);
          }
        }

        const headers = result.meta.fields ?? [];
        if (headers.length === 0) {
          errors.push('CSV has no header row.');
          resolve({ stories, errors, warnings });
          return;
        }

        const keyField = findField(headers, KEY_FIELDS);
        const summaryField = findField(headers, SUMMARY_FIELDS);
        const pointsField = findField(headers, POINTS_FIELDS);
        const rolloverField = findField(headers, ROLLOVER_FIELDS);

        if (!keyField) errors.push('Missing required column: Issue Key.');
        if (!pointsField) errors.push('Missing required column: Story Points.');

        if (errors.length > 0) {
          resolve({ stories, errors, warnings });
          return;
        }

        const seen = new Set<string>();
        result.data.forEach((row, i) => {
          const issueKey = (row[keyField!] ?? '').trim();
          const summary = summaryField ? (row[summaryField] ?? '').trim() : '';
          const rawPoints = (row[pointsField!] ?? '').trim();
          if (!issueKey) {
            warnings.push(`Row ${i + 2}: skipped — empty Issue Key.`);
            return;
          }
          if (seen.has(issueKey)) {
            warnings.push(`Row ${i + 2}: skipped duplicate "${issueKey}".`);
            return;
          }
          const sp = Number(rawPoints);
          if (!rawPoints || Number.isNaN(sp)) {
            warnings.push(
              `Row ${i + 2} (${issueKey}): missing/invalid Story Points — defaulted to 0.`,
            );
          }
          seen.add(issueKey);
          const rawRollover = rolloverField ? (row[rolloverField] ?? '').trim().toUpperCase() : '';
          stories.push({
            issueKey,
            summary: summary || issueKey,
            storyPoints: Number.isNaN(sp) ? 0 : sp,
            startDay: 1,
            rollover: rawRollover === 'Y',
            override: false,
            overrideCells: [],
            dependencies: [],
          });
        });

        resolve({ stories, errors, warnings });
      },
      error: (err: Error) => {
        resolve({ stories: [], errors: [err.message], warnings: [] });
      },
    });
  });
}
