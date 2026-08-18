import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEGACY_VERSION = '0.8.2';
export const LEGACY_TAG = `v${LEGACY_VERSION}`;
export const LEGACY_COMMIT = '01ce8a669bd81ec76b4d10750e406b601f6e2f51';

const scriptFolder = path.dirname(fileURLToPath(import.meta.url));
const defaultDocsRoot = path.resolve(scriptFolder, '..');
const defaultRepositoryRoot = path.resolve(defaultDocsRoot, '..');
const archivePrefix = `/${LEGACY_VERSION}`;

const archivedNotice = `::: warning Archived documentation
You are reading the XRPL Connect ${LEGACY_VERSION} documentation. [Switch to 1.0.0](/) or follow
the [0.8.2 → 1.0.0 migration guide](/guide/migration-v1).
:::
`;
const generatedHeader = `<!-- Generated from ${LEGACY_TAG}; do not edit. -->\n\n${archivedNotice}`;

function runGit(repositoryRoot, args) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function insertArchivedNotice(markdown) {
  if (!markdown.startsWith('---\n')) return `${generatedHeader}\n${markdown}`;

  const frontmatterEnd = markdown.indexOf('\n---\n', 4);
  if (frontmatterEnd === -1) return `${generatedHeader}\n${markdown}`;

  const contentStart = frontmatterEnd + 5;
  return `${markdown.slice(0, contentStart)}\n${generatedHeader}\n${markdown.slice(contentStart)}`;
}

export function transformLegacyMarkdown(markdown, relativePath) {
  let transformed = markdown
    .replace(/\]\(\/(?!0\.8\.2\/)([^)]+)\)/g, `](${archivePrefix}/$1)`)
    .replace(/^(npm install|pnpm add|yarn add) .+$/gm, (command) =>
      command.replace(/(?<![@\w-])xrpl-connect(?![@\w/-])/g, 'xrpl-connect@0.8.2')
    )
    .replace(/<DownloadLLMsFullDoc\s*\/>\s*/g, '')
    .replace(
      /<TryItOut\s*\/>/g,
      '::: info Archived interactive demo\nThe live demo uses the current release. Switch to the 1.0.0 documentation to run it.\n:::'
    )
    .replace(
      /<ThemeBuilder\s*\/>/g,
      '::: info Archived interactive builder\nThe live builder uses the current release. Switch to the 1.0.0 documentation to run it.\n:::'
    );

  if (relativePath === 'try-it-out.md' || relativePath === 'customization-builder.md') {
    transformed = transformed
      .replace(/<script setup>[\s\S]*?<\/script>\s*/g, '')
      .replace(/<\/?ClientOnly>\s*/g, '')
      .replace(/^  :::/gm, ':::');
  }

  if (relativePath === 'index.md') {
    transformed = transformed.replace(
      '# Introduction to XRPL-Connect',
      `# XRPL Connect ${LEGACY_VERSION}`
    );
  }

  return insertArchivedNotice(transformed);
}

function validateGeneratedPage(markdown, relativePath) {
  if (!markdown.includes(`Generated from ${LEGACY_TAG}`)) {
    throw new Error(`${relativePath} is missing its generated-source marker`);
  }
  if (!markdown.includes(`XRPL Connect ${LEGACY_VERSION} documentation`)) {
    throw new Error(`${relativePath} is missing its archived-version notice`);
  }
  if (/<(?:TryItOut|ThemeBuilder|DownloadLLMsFullDoc)\b/.test(markdown)) {
    throw new Error(`${relativePath} still contains a current-version interactive component`);
  }
  if (/components\/(?:TryItOut|ThemeBuilder)\.vue/.test(markdown)) {
    throw new Error(`${relativePath} still imports a current-version interactive component`);
  }
  if (
    (relativePath === 'try-it-out.md' || relativePath === 'customization-builder.md') &&
    /<\/?ClientOnly>/.test(markdown)
  ) {
    throw new Error(`${relativePath} still wraps its archive notice in a client-only boundary`);
  }

  for (const match of markdown.matchAll(/\]\((\/[^)]+)\)/g)) {
    const link = match[1];
    if (link === '/' || link === '/guide/migration-v1' || link.startsWith(`${archivePrefix}/`)) {
      continue;
    }
    throw new Error(`${relativePath} contains an unversioned internal link: ${link}`);
  }

  for (const command of markdown.matchAll(/^(?:npm install|pnpm add|yarn add) .+$/gm)) {
    if (/(?<![@\w-])xrpl-connect(?!@0\.8\.2)(?![@\w/-])/.test(command[0])) {
      throw new Error(`${relativePath} contains an unpinned 0.8.2 install command: ${command[0]}`);
    }
  }
}

function collectFiles(root) {
  const walk = (current) =>
    readdirSync(current).flatMap((entry) => {
      const entryPath = path.join(current, entry);
      return statSync(entryPath).isDirectory() ? walk(entryPath) : [entryPath];
    });

  return walk(root)
    .map((file) => path.relative(root, file))
    .sort();
}

function buildSnapshot(repositoryRoot) {
  let resolvedCommit;
  try {
    resolvedCommit = runGit(repositoryRoot, ['rev-parse', `${LEGACY_TAG}^{commit}`]).trim();
  } catch {
    throw new Error(
      `The ${LEGACY_TAG} tag is required to update or check the snapshot. Run: git fetch origin tag ${LEGACY_TAG}`
    );
  }

  if (resolvedCommit !== LEGACY_COMMIT) {
    throw new Error(
      `${LEGACY_TAG} resolved to ${resolvedCommit}, expected immutable commit ${LEGACY_COMMIT}`
    );
  }

  const sourceFiles = runGit(repositoryRoot, ['ls-tree', '-r', '--name-only', LEGACY_TAG, 'docs'])
    .split('\n')
    .filter((file) => file.endsWith('.md'));

  if (
    !sourceFiles.includes('docs/index.md') ||
    !sourceFiles.includes('docs/guide/getting-started.md')
  ) {
    throw new Error(`${LEGACY_TAG} does not contain the expected documentation entry points`);
  }

  const pages = new Map();
  for (const sourceFile of sourceFiles) {
    const relativePath = path.relative('docs', sourceFile);
    const markdown = runGit(repositoryRoot, ['show', `${LEGACY_TAG}:${sourceFile}`]);
    const transformed = transformLegacyMarkdown(markdown, relativePath);
    validateGeneratedPage(transformed, relativePath);
    pages.set(relativePath, transformed);
  }

  pages.set(
    '.snapshot.json',
    `${JSON.stringify(
      {
        version: LEGACY_VERSION,
        sourceTag: LEGACY_TAG,
        sourceCommit: resolvedCommit,
        pages: [...pages.keys()],
      },
      null,
      2
    )}\n`
  );

  return { pages, resolvedCommit };
}

export function prepareVersionedDocs({
  docsRoot = defaultDocsRoot,
  repositoryRoot = defaultRepositoryRoot,
  check = false,
} = {}) {
  const { pages, resolvedCommit } = buildSnapshot(repositoryRoot);
  const outputRoot = path.join(docsRoot, LEGACY_VERSION);

  if (check) {
    const actualFiles = collectFiles(outputRoot);
    const expectedFiles = [...pages.keys()].sort();
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
      throw new Error(`${outputRoot} has stale files. Run: pnpm run docs:snapshot:0.8.2`);
    }

    for (const [relativePath, expected] of pages) {
      const actual = readFileSync(path.join(outputRoot, relativePath), 'utf-8');
      if (actual !== expected) {
        throw new Error(
          `${path.join(outputRoot, relativePath)} is stale. Run: pnpm run docs:snapshot:0.8.2`
        );
      }
    }
  } else {
    rmSync(outputRoot, { force: true, recursive: true });
    for (const [relativePath, contents] of pages) {
      const outputPath = path.join(outputRoot, relativePath);
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, contents);
    }
  }

  return { outputRoot, pageCount: pages.size - 1, resolvedCommit };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const result = prepareVersionedDocs({ check });
  console.log(
    `✓ ${check ? 'Verified' : 'Prepared'} ${result.pageCount} pages for XRPL Connect ${LEGACY_VERSION} from ${result.resolvedCommit}`
  );
}
