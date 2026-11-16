import type { Branch, User } from '../../types';
import { offlineDb } from './db';

export interface PosSession {
  user: User;
  branches: Branch[];
  selectedBranch: Branch;
}

export async function savePosSession(session: PosSession): Promise<void> {
  await offlineDb.session.put({
    id: 'current',
    ...session,
    savedAt: new Date().toISOString(),
  });
}

export async function loadPosSession(): Promise<PosSession | null> {
  const row = await offlineDb.session.get('current');
  if (!row) return null;
  return {
    user: row.user,
    branches: row.branches,
    selectedBranch: row.selectedBranch,
  };
}

export async function clearPosSession(): Promise<void> {
  await offlineDb.session.delete('current');
}
