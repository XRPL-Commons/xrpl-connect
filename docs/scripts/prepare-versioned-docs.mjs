import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Archived documentation versions, newest first. Each version is generated from its immutable
 * release tag into docs/<version>/ and served beside the current documentation at the site root.
 *
 * - `releasePackages`: coordinated packages that existed in that release. Install commands pin
 *   every one of them to the archived version.
 * - `migrationGuide`: optional current-docs page that the archived notice links to.
 * - `replacements`: exact text replacements per page, for statements that are only true while the
 *   version is current. Each search string must occur exactly once in the tagged page.
 */
export const ARCHIVED_VERSIONS = [
  {
    version: '1.0.0',
    tag: 'v1.0.0',
    commit: '69a616ae02453ab7068dbf6abf1439d6d8deb00e',
    releasePackages: [
      'xrpl-connect',
      '@xrpl-commons/xrpl-connect-react',
      '@xrpl-commons/xrpl-connect-vue',
    ],
    replacements: {
      'index.md': [
        [
          "::: info Current release channel\nThis documentation tracks the stable 1.0.0 API. The coordinated `xrpl-connect`, React, and Vue packages are available from npm's default stable channel.",
          '::: info Release channel\nThis documentation tracks the stable 1.0.0 API. Its install commands pin the coordinated `xrpl-connect`, React, and Vue packages to `1.0.0`.',
        ],
      ],
      'guide/getting-started.md': [
        [
          "Stable v1 is published under npm's default channel. Install the coordinated packages by their\nbare names and keep the framework binding and `xrpl-connect` versions aligned.",
          'These archived commands pin the coordinated packages to `1.0.0`. Keep the framework binding\nand `xrpl-connect` versions aligned.',
        ],
      ],
      'guide/migration-v1.md': [
        [
          '::: info Current release channel\nThe current stable release is `1.0.0`. Install the coordinated packages by their bare names.',
          '::: info Release channel\nThese archived commands pin the coordinated packages to `1.0.0`.',
        ],
      ],
    },
  },
  {
    version: '0.8.2',
    tag: 'v0.8.2',
    commit: '01ce8a669bd81ec76b4d10750e406b601f6e2f51',
    releasePackages: ['xrpl-connect'],
    migrationGuide: '/guide/migration-v1',
    replacements: {
      'index.md': [['# Introduction to XRPL-Connect', '# XRPL Connect 0.8.2']],
    },
  },
];

const scriptFolder = path.dirname(fileURLToPath(import.meta.url));
const defaultDocsRoot = path.resolve(scriptFolder, '..');
const defaultRepositoryRoot = path.resolve(defaultDocsRoot, '..');

const archivedPrefixes = ARCHIVED_VERSIONS.map(({ version }) => `/${version}/`);
const archivedVersionPattern = ARCHIVED_VERSIONS.map(({ version }) =>
  version.replaceAll('.', '\\.')
).join('|');
// Root-relative Markdown links that do not already point into an archived version.
const unversionedLinkPattern = new RegExp(
  String.raw`\]\(\/(?!(?:${archivedVersionPattern})\/)([^)]*)\)`,
  'g'
);
const installCommandPattern = /^[ \t]*(?:npm install|pnpm add|yarn add)[ \t].*$/gm;
const interactivePages = new Set(['try-it-out.md', 'customization-builder.md']);

function runGit(repositoryRoot, args) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function generatedHeader({ version, tag, migrationGuide }) {
  const migration = migrationGuide
    ? ` or follow the [migration guide from ${version}](${migrationGuide})`
    : '';
  return `<!-- Generated from ${tag}; do not edit. -->

::: warning Archived documentation
You are reading the XRPL Connect ${version} documentation. [Switch to the current documentation](/)${migration}.
:::
`;
}

function insertGeneratedHeader(markdown, header) {
  if (!markdown.startsWith('---\n')) return `${header}\n${markdown}`;

  const frontmatterEnd = markdown.indexOf('\n---\n', 4);
  if (frontmatterEnd === -1) return `${header}\n${markdown}`;

  const contentStart = frontmatterEnd + 5;
  return `${markdown.slice(0, contentStart)}\n${header}\n${markdown.slice(contentStart)}`;
}

function findReleasePackage(dependency, releasePackages) {
  return releasePackages.find((name) => dependency === name || dependency.startsWith(`${name}@`));
}

function applyReplacements(markdown, replacements, relativePath, tag) {
  return replacements.reduce((transformed, [search, replacement]) => {
    if (transformed.split(search).length !== 2) {
      throw new Error(`${tag}:docs/${relativePath} must contain exactly one: ${search}`);
    }
    return transformed.replace(search, () => replacement);
  }, markdown);
}

export function transformArchivedMarkdown(markdown, relativePath, archive) {
  const { version, releasePackages, replacements = {} } = archive;
  let transformed = applyReplacements(
    markdown,
    replacements[relativePath] ?? [],
    relativePath,
    archive.tag
  )
    .replace(unversionedLinkPattern, `](/${version}/$1)`)
    .replace(installCommandPattern, (command) =>
      command.replace(/\S+/g, (dependency) => {
        const releasePackage = findReleasePackage(dependency, releasePackages);
        return releasePackage ? `${releasePackage}@${version}` : dependency;
      })
    )
    .replace(/<DownloadLLMsFullDoc\s*\/>\s*/g, '')
    .replace(
      /<TryItOut\s*\/>/g,
      '::: info Archived interactive demo\nThe live demo uses the current release. Switch to the current documentation to run it.\n:::'
    )
    .replace(
      /<ThemeBuilder\s*\/>/g,
      '::: info Archived interactive builder\nThe live builder uses the current release. Switch to the current documentation to run it.\n:::'
    );

  if (interactivePages.has(relativePath)) {
    transformed = transformed
      .replace(/<script setup>[\s\S]*?<\/script>\s*/g, '')
      .replace(/<\/?ClientOnly>\s*/g, '')
      .replace(/^  :::/gm, ':::');
  }

  return insertGeneratedHeader(transformed, generatedHeader(archive));
}

function validateGeneratedPage(markdown, relativePath, archive) {
  const { version, releasePackages } = archive;
  const header = generatedHeader(archive);
  if (!markdown.includes(header)) {
    throw new Error(`${relativePath} is missing its generated-source marker or archived notice`);
  }
  if (/<(?:TryItOut|ThemeBuilder|DownloadLLMsFullDoc)\b/.test(markdown)) {
    throw new Error(`${relativePath} still contains a current-version interactive component`);
  }
  if (/components\/(?:TryItOut|ThemeBuilder)\.vue/.test(markdown)) {
    throw new Error(`${relativePath} still imports a current-version interactive component`);
  }
  if (interactivePages.has(relativePath) && /<\/?ClientOnly>/.test(markdown)) {
    throw new Error(`${relativePath} still wraps its archive notice in a client-only boundary`);
  }

  // Only the generated notice may link to the current documentation. Page links stay inside this
  // archive or point at another archived version, which is served unchanged.
  const body = markdown.replace(header, '');
  for (const [, link] of body.matchAll(/\]\((\/[^)]*)\)/g)) {
    if (!archivedPrefixes.some((prefix) => link.startsWith(prefix))) {
      throw new Error(`${relativePath} contains an unversioned internal link: ${link}`);
    }
  }

  const pinnedPackages = new Set();
  for (const [command] of markdown.matchAll(installCommandPattern)) {
    for (const dependency of command.trim().split(/\s+/)) {
      const releasePackage = findReleasePackage(dependency, releasePackages);
      if (!releasePackage) continue;
      if (dependency !== `${releasePackage}@${version}`) {
        throw new Error(
          `${relativePath} contains an unpinned ${version} install command: ${command.trim()}`
        );
      }
      pinnedPackages.add(releasePackage);
    }
  }
  return pinnedPackages;
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

function buildSnapshot(repositoryRoot, archive) {
  const { version, tag, commit, releasePackages, replacements = {} } = archive;
  let resolvedCommit;
  try {
    resolvedCommit = runGit(repositoryRoot, ['rev-parse', `${tag}^{commit}`]).trim();
  } catch {
    throw new Error(
      `The ${tag} tag is required to update or check the snapshot. Run: git fetch origin tag ${tag}`
    );
  }

  if (resolvedCommit !== commit) {
    throw new Error(`${tag} resolved to ${resolvedCommit}, expected immutable commit ${commit}`);
  }

  const trackedFiles = runGit(repositoryRoot, ['ls-tree', '-r', '--name-only', tag, 'docs']).split(
    '\n'
  );
  // A release tag also contains the archives generated before it; only its own pages are copied.
  const archiveFolders = trackedFiles
    .filter((file) => file.endsWith('/.snapshot.json'))
    .map((file) => `${path.posix.dirname(file)}/`);
  const sourceFiles = trackedFiles.filter(
    (file) => file.endsWith('.md') && !archiveFolders.some((folder) => file.startsWith(folder))
  );

  if (
    !sourceFiles.includes('docs/index.md') ||
    !sourceFiles.includes('docs/guide/getting-started.md')
  ) {
    throw new Error(`${tag} does not contain the expected documentation entry points`);
  }

  const pages = new Map();
  const pinnedPackages = new Set();
  for (const sourceFile of sourceFiles) {
    const relativePath = path.posix.relative('docs', sourceFile);
    const markdown = runGit(repositoryRoot, ['show', `${tag}:${sourceFile}`]);
    const transformed = transformArchivedMarkdown(markdown, relativePath, archive);
    for (const releasePackage of validateGeneratedPage(transformed, relativePath, archive)) {
      pinnedPackages.add(releasePackage);
    }
    pages.set(relativePath, transformed);
  }

  for (const relativePath of Object.keys(replacements)) {
    if (!pages.has(relativePath)) {
      throw new Error(`${tag} has no docs/${relativePath} page to apply replacements to`);
    }
  }
  const undocumentedPackages = releasePackages.filter((name) => !pinnedPackages.has(name));
  if (undocumentedPackages.length > 0) {
    throw new Error(
      `${tag} documents no install command for ${undocumentedPackages.join(', ')}; update its release packages`
    );
  }

  pages.set(
    '.snapshot.json',
    `${JSON.stringify(
      {
        version,
        sourceTag: tag,
        sourceCommit: resolvedCommit,
        pages: [...pages.keys()],
      },
      null,
      2
    )}\n`
  );

  return { pages, resolvedCommit };
}

function assertFreshSnapshot(outputRoot, pages) {
  const staleMessage = 'Run: pnpm run docs:snapshot';
  const actualFiles = existsSync(outputRoot) ? collectFiles(outputRoot) : [];
  const expectedFiles = [...pages.keys()].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`${outputRoot} has missing or stale files. ${staleMessage}`);
  }

  for (const [relativePath, expected] of pages) {
    const outputPath = path.join(outputRoot, relativePath);
    if (readFileSync(outputPath, 'utf-8') !== expected) {
      throw new Error(`${outputPath} is stale. ${staleMessage}`);
    }
  }
}

function writeSnapshot(outputRoot, pages) {
  rmSync(outputRoot, { force: true, recursive: true });
  for (const [relativePath, contents] of pages) {
    const outputPath = path.join(outputRoot, relativePath);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, contents);
  }
}

export function prepareVersionedDocs({
  docsRoot = defaultDocsRoot,
  repositoryRoot = defaultRepositoryRoot,
  check = false,
} = {}) {
  // Build and validate every archive before writing any, so a failure leaves the tree untouched.
  const snapshots = ARCHIVED_VERSIONS.map((archive) => ({
    archive,
    outputRoot: path.join(docsRoot, archive.version),
    ...buildSnapshot(repositoryRoot, archive),
  }));

  return snapshots.map(({ archive, outputRoot, pages, resolvedCommit }) => {
    if (check) {
      assertFreshSnapshot(outputRoot, pages);
    } else {
      writeSnapshot(outputRoot, pages);
    }
    return { version: archive.version, outputRoot, pageCount: pages.size - 1, resolvedCommit };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  for (const result of prepareVersionedDocs({ check })) {
    console.log(
      `✓ ${check ? 'Verified' : 'Prepared'} ${result.pageCount} pages for XRPL Connect ${result.version} from ${result.resolvedCommit}`
    );
  }
}
