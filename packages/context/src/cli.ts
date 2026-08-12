import { parseArgs } from 'node:util';
import { compile } from './compile.ts';

const { values } = parseArgs({
  options: {
    brand: { type: 'string', default: 'default' },
    now: { type: 'string' },
    out: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});

if (values.help) {
  console.log(
    [
      'Usage: node src/cli.ts [--brand <name>] [--now <ISO timestamp>] [--out <dir>]',
      '',
      '  --brand  brand file to compile for (brands/<name>.json); default: default',
      '  --now    ISO timestamp recorded in manifest.json; default: build time.',
      '           Pass a fixed value for byte-identical builds.',
      '  --out    output directory; default: packages/context/dist/<brand>',
    ].join('\n'),
  );
  process.exit(0);
}

try {
  const report = compile({
    brand: values.brand,
    ...(values.now !== undefined ? { now: values.now } : {}),
    ...(values.out !== undefined ? { outDir: values.out } : {}),
  });
  const totalBytes = report.files.reduce((n, f) => n + f.bytes, 0);
  console.log(`@ds/context: compiled brand "${report.brand}" -> ${report.outDir}`);
  console.log(`  ${report.files.length} files + manifest.json, ${totalBytes} bytes, source sha256:${report.sourceHash.slice(0, 16)}`);
  for (const f of report.files.filter((f) => f.path.startsWith('llms'))) {
    console.log(`  ${f.path}: ~${f.estTokens} tokens (${f.bytes} bytes)`);
  }
  for (const w of report.warnings) console.warn(`  WARN: ${w}`);
} catch (err) {
  console.error(`@ds/context: build failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
