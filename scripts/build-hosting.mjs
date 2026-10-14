import { cp, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Only public app assets belong in Hosting. Local documents, tooling and keys stay out.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const entries = ['index.html', 'main.html', 'compare.html', 'admin.html', 'firebase-config.js', 'css', 'js'];

await mkdir(output, { recursive: true });
// Avoid silently publishing stale files from a previous, unrelated build.
const unexpected = (await readdir(output)).filter(name => !entries.includes(name));
if (unexpected.length) throw new Error(`Unexpected files in dist: ${unexpected.join(', ')}`);
for (const entry of entries) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}
console.log(`Hosting assets prepared: ${entries.join(', ')}`);
