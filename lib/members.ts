import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseMembers } from './rules.ts';

// The IC members list. .members holds only SHA-256 hashes of official college emails, so it can sit
// in a public repository without showing anyone's address. The site hashes the email someone types
// and looks for it. The fixed "icdms:" prefix keeps these hashes from matching hash lists made elsewhere.
// ponytail: an exact guessed address can still be checked against the list; a secret pepper would stop that but makes add-member need the secret

export const memberHash = (email: string) => createHash('sha256').update(`icdms:${email.trim().toLowerCase()}`).digest('hex');

export const MEMBERS_FILE = path.join(process.cwd(), '.members');
let memo: Set<string> | undefined;

export function isMember(email: string) {
  // The list only changes with a deploy, so production reads it once
  const hashes = memo ?? new Set(parseMembers(readFileSync(MEMBERS_FILE, 'utf8')).hashes);
  if (process.env.NODE_ENV === 'production') memo = hashes;
  return hashes.has(memberHash(email));
}
