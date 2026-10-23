import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { config } from './config.js';

export interface HistoryEntry {
  date: string;
  type?: 'photo' | 'reel';
  platform?: string;
  pillar: string;     // content category id
  format?: string;
  topic: string;
  headline: string;
  postId?: string;
  url?: string;
  sources?: string[];
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    return JSON.parse(await readFile(config.historyFile, 'utf8'));
  } catch {
    return [];
  }
}

export async function saveHistory(entries: HistoryEntry[]): Promise<void> {
  await mkdir(dirname(config.historyFile), { recursive: true });
  await writeFile(config.historyFile, JSON.stringify(entries.slice(-300), null, 2) + '\n');
}
