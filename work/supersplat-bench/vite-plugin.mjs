import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const release = path.join(root, 'vendor/playcanvas/build/playcanvas/src');
/** Install in the root runner's Vite config; no existing engine source is changed. */
export function supersplatBenchmarkPlugin({ instrumentation = true } = {}) {
  return {
    name: 'pinned-supersplat-editor-2.1.0', enforce: 'pre',
    resolveId(source, importer) {
      if (source === 'playcanvas') return path.join(release, 'index.js');
      if (instrumentation && source.endsWith('/gsplat-sorter.js') && importer?.replace(/\\/g, '/').includes('/vendor/playcanvas/build/playcanvas/src/')) {
        return path.join(root, 'dist/gsplat-sorter.benchmark.js');
      }
    },
  };
}
