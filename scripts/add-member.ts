// Add IC members to .members. Each email is stored only as a hash, so the file never holds a readable address.
//   npm run add-member name@nitp.ac.in [another@nitp.ac.in ...]
// To remove someone, print their line, delete it from .members, and commit:
//   npm run add-member -- --find name@nitp.ac.in
import { appendFileSync, readFileSync } from 'node:fs';
import { memberHash, MEMBERS_FILE } from '../lib/members.ts';
import { isEmail, parseMembers } from '../lib/rules.ts';

const args = process.argv.slice(2);
const find = args[0] === '--find';
const emails = find ? args.slice(1) : args;
if (!emails.length) {
  console.error('Usage: npm run add-member name@nitp.ac.in');
  process.exit(1);
}

const text = readFileSync(MEMBERS_FILE, 'utf8');
const { hashes } = parseMembers(text);
if (!find && text && !text.endsWith('\n')) appendFileSync(MEMBERS_FILE, '\n');

for (const email of emails) {
  if (!isEmail(email)) {
    console.error(`Not an email address: ${email}`);
    process.exitCode = 1;
    continue;
  }
  const hash = memberHash(email);
  if (find) console.log(hashes.includes(hash) ? `${email} is this line in .members:\n${hash}` : `${email} is not on the list`);
  else if (hashes.includes(hash)) console.log(`Already a member: ${email}`);
  else {
    appendFileSync(MEMBERS_FILE, `${hash}\n`);
    hashes.push(hash);
    console.log(`Added: ${email}`);
  }
}
if (!find) console.log('Commit .members and push; the change applies after the next deploy.');
