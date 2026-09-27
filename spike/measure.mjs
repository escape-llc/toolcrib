import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
const entries = process.argv.slice(2);
for (const name of entries) {
  const outDir = resolve('spike/dist', name);
  await build({
    logLevel: 'silent',
    configFile: false,
    plugins: [react()],
    build: {
      outDir,
      emptyOutDir: true,
      minify: true,
      lib: { entry: resolve('spike', `${name}.tsx`), formats: ['es'], fileName: name },
      rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'] },
    },
  });
  const files = readdirSync(outDir).filter(f => f.endsWith('.js'));
  let raw = 0, gz = 0;
  for (const f of files) { const b = readFileSync(resolve(outDir, f)); raw += b.length; gz += gzipSync(b).length; }
  console.log(`${name.padEnd(18)} min ${(raw / 1024).toFixed(1)} KB   gzip ${(gz / 1024).toFixed(1)} KB`);
}