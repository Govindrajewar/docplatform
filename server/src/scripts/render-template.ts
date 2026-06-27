import { readFile, writeFile } from 'fs/promises';
import path from 'path';

import FileType from 'file-type';
import { templateDocumentSchema } from '@platform/shared';

import { render } from '../engine/render';
import type { AssetMap } from '../engine/types';

interface CliArgs {
  template: string;
  data: string;
  out: string;
  assets?: string;
  maxPages?: number;
  maxTableRows?: number;
}

const USAGE = `Usage: tsx src/scripts/render-template.ts --template <template.json> --data <data.json> --out <output.pdf> [--assets <assets-manifest.json>] [--max-pages <n>] [--max-table-rows <n>]

  --template          Path to a Template JSON document (validated against the shared schema).
  --data              Path to a JSON file providing the data context (and optional "fields"/asset keys).
  --out               Path to write the rendered PDF.
  --assets            Path to a JSON manifest mapping asset keys to file paths, e.g.
                       { "companyLogo": "./logo.png" }. Referenced by image/signature elements'
                       resolved "src" value, which must match a key in this manifest.
  --max-pages         Safety ceiling on emitted pages (default: engine default of 500).
  --max-table-rows    Safety ceiling on a single table's row count (default: unlimited).
`;

function parseArgs(argv: string[]): CliArgs {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(`Malformed argument near "${flag ?? ''}"\n\n${USAGE}`);
    }
    args.set(flag.slice(2), value);
  }

  const template = args.get('template');
  const data = args.get('data');
  const out = args.get('out');
  if (!template || !data || !out) {
    throw new Error(`Missing required argument(s).\n\n${USAGE}`);
  }

  const maxPages = args.get('max-pages');
  const maxTableRows = args.get('max-table-rows');

  return {
    template,
    data,
    out,
    assets: args.get('assets'),
    maxPages: maxPages ? Number(maxPages) : undefined,
    maxTableRows: maxTableRows ? Number(maxTableRows) : undefined,
  };
}

async function loadAssets(manifestPath: string | undefined): Promise<AssetMap> {
  if (!manifestPath) return {};

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Record<string, string> = JSON.parse(manifestRaw);
  const manifestDir = path.dirname(manifestPath);

  const assets: AssetMap = {};
  for (const [key, relativeFilePath] of Object.entries(manifest)) {
    const filePath = path.resolve(manifestDir, relativeFilePath);
    const buffer = await readFile(filePath);
    const detected = await FileType.fromBuffer(buffer);
    const mimeType =
      detected?.mime ??
      (relativeFilePath.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream');
    assets[key] = { buffer, mimeType };
  }
  return assets;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const templateRaw = JSON.parse(await readFile(args.template, 'utf-8'));
  const template = templateDocumentSchema.parse(templateRaw);
  const data = JSON.parse(await readFile(args.data, 'utf-8'));
  const assets = await loadAssets(args.assets);

  const buffer = await render({
    template,
    data,
    assets,
    maxPages: args.maxPages,
    maxTableRows: args.maxTableRows,
  });

  await writeFile(args.out, buffer);
  // eslint-disable-next-line no-console
  console.log(`Rendered ${buffer.length} bytes to ${args.out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
