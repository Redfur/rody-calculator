import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/**
 * Собирает sw.js из sw/sw.template.js: подставляет список всех файлов сборки
 * (бандл + public/) для предзагрузки и хеш содержимого как версию кэша.
 */
export function serviceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'rody-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const hash = createHash('sha256');
      const files: string[] = [];

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.map')) continue;
        files.push(fileName);
        hash.update(fileName);
        hash.update(chunk.type === 'chunk' ? chunk.code : chunk.source);
      }
      for (const abs of listFiles(publicDir)) {
        const fileName = relative(publicDir, abs).split('\\').join('/');
        files.push(fileName);
        hash.update(fileName);
        hash.update(readFileSync(abs));
      }

      const precache = ['./', ...files.sort().map((f) => `./${f}`)];
      const template = readFileSync(new URL('./sw/sw.template.js', import.meta.url), 'utf8');
      const source = template
        .replace("'rody-v1-__BUILD__'", () => `'rody-v1-${hash.digest('hex').slice(0, 10)}'`)
        .replace('= __PRECACHE__;', () => `= ${JSON.stringify(precache, null, 2)};`);
      if (source.includes('__BUILD__') || source.includes('__PRECACHE__')) {
        this.error('sw.template.js: не удалось подставить версию или список файлов');
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
