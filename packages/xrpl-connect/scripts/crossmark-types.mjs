import {
  cpSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

export function prepareCrossmarkTypes(projectFolder) {
  const crossmarkFolder = realpathSync(
    path.join(projectFolder, '../adapters/crossmark/node_modules/@crossmarkio/typings')
  );
  const require = createRequire(path.join(crossmarkFolder, 'package.json'));
  const temporaryFolder = mkdtempSync(path.join(projectFolder, 'dist/crossmark-types-'));
  const cleanup = () => rmSync(temporaryFolder, { recursive: true, force: true });

  try {
    const copyDeclarations = (source, destination) => {
      cpSync(source, destination, {
        recursive: true,
        filter: (file) => statSync(file).isDirectory() || file.endsWith('.d.ts'),
      });
    };
    // Keep Crossmark's merged class/namespace declarations in their original
    // files; flattening them with API Extractor loses type/value distinctions.
    const publishedTypes = path.join(projectFolder, 'dist-publish/types');
    const crossmarkTypes = path.join(publishedTypes, 'crossmark/build/src');
    rmSync(publishedTypes, { recursive: true, force: true });
    copyDeclarations(path.join(crossmarkFolder, 'build/src'), crossmarkTypes);

    const ledgerTypes = {};
    for (const [name, directory] of [
      ['@transia/xrpl', 'transia'],
      ['xrpl', 'xrpl'],
    ]) {
      const manifestPath = require.resolve(`${name}/package.json`);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const entry = path.join(path.dirname(manifestPath), manifest.types);
      const destination = path.join(temporaryFolder, directory);
      copyDeclarations(path.dirname(entry), destination);
      ledgerTypes[name] = path.join(destination, path.basename(entry));
    }

    // Preserve Crossmark's XRPL v2 types independently of the consumer's XRPL peer.
    const transactionOutput = path.join(crossmarkTypes, 'crossmark/models/common/tx.d.ts');
    const transactionTypes = path.join(temporaryFolder, 'tx.d.ts');
    const transactions = readFileSync(transactionOutput, 'utf8');
    if (!transactions.includes("from 'xrpl'")) {
      throw new Error('Crossmark transaction declaration layout changed');
    }
    writeFileSync(transactionTypes, transactions.replace("from 'xrpl'", "from 'crossmark-xrpl'"));

    // Only cipher.Algorithm is reachable from Crossmark. Generate its exact
    // upstream union without exposing Forge's runtime or unrelated global types.
    const forgePath = require.resolve('@types/node-forge/index.d.ts');
    const forge = ts.createSourceFile(
      forgePath,
      readFileSync(forgePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    let algorithms;
    const visit = (node) => {
      if (
        ts.isModuleDeclaration(node) &&
        node.name.text === 'cipher' &&
        node.body &&
        ts.isModuleBlock(node.body)
      ) {
        const alias = node.body.statements.find(
          (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'Algorithm'
        );
        if (
          alias &&
          ts.isUnionTypeNode(alias.type) &&
          alias.type.types.every(
            (type) => ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal)
          )
        ) {
          algorithms = alias.type.types.map((type) => JSON.stringify(type.literal.text));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(forge);
    if (!algorithms?.length) throw new Error('Unsupported node-forge cipher.Algorithm declaration');
    const forgeTypes = path.join(publishedTypes, 'forge.d.ts');
    writeFileSync(
      forgeTypes,
      `export namespace cipher { export type Algorithm = ${algorithms.join(' | ')}; }\n`
    );

    for (const relative of readdirSync(crossmarkTypes, { recursive: true })) {
      if (!relative.endsWith('.d.ts')) continue;
      const file = path.join(crossmarkTypes, relative);
      const forgeImport = path
        .relative(path.dirname(file), forgeTypes)
        .split(path.sep)
        .join('/')
        .replace(/\.d\.ts$/, '');
      writeFileSync(
        file,
        readFileSync(file, 'utf8').replaceAll("from 'node-forge'", `from '${forgeImport}'`)
      );
    }

    return {
      cleanup,
      transactionEntry: transactionTypes,
      transactionOutput,
      paths: {
        '@transia/xrpl': [ledgerTypes['@transia/xrpl']],
        '@transia/xrpl/dist/npm/*': [path.join(temporaryFolder, 'transia/*')],
        'crossmark-xrpl': [ledgerTypes.xrpl],
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
