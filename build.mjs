import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const html = (await read('./index.html')).replace(/\r\n/g, '\n');
const model = (await read('./estimate.mjs')).replace(/^export /gm, '').trimEnd();
const begin = '// BEGIN GENERATED ESTIMATE MODEL';
const end = '// END GENERATED ESTIMATE MODEL';
const start = html.indexOf(begin);
const finish = html.indexOf(end);
if (start === -1 || finish <= start) throw new Error('Missing estimate model markers');
const built = html.slice(0, start) + begin + '\n' + model + '\n' + html.slice(finish);
const inline = built.match(/<script>\s*([\s\S]*?)<\/script>/);
if (!inline) throw new Error('Missing browser script');
new Script(inline[1], { filename: 'index.html' });
if (process.argv.includes('--sync')) {
  await writeFile(new URL('./index.html', import.meta.url), built);
} else if (html !== built) {
  throw new Error('Generated model is stale. Run node build.mjs --sync.');
}
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await writeFile(new URL('./dist/index.html', import.meta.url), built);

