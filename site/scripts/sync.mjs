// Copies the plugin's shared card module and scoring config into the site, so the website renders
// cards and explains the score with exactly the same code and numbers as the plugin.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = path.join(SITE, '..', 'plugins', 'claude-dependency-test');
if (!fs.existsSync(PLUGIN)) {
  // e.g. a host that only uploads site/: the committed copies are used (a test keeps them identical).
  console.log('plugin folder not found, keeping the committed copies of card.js and scoring.json');
  process.exit(0);
}
for (const [from, to] of [
  ['assets/card.js', 'public/card.js'],
  ['config/scoring.json', 'public/scoring.json'],
]) {
  fs.copyFileSync(path.join(PLUGIN, from), path.join(SITE, to));
  console.log(`synced ${from} -> site/${to}`);
}
