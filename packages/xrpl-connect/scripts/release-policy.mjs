import assert from 'node:assert/strict';

export const NPM_REGISTRY = 'https://registry.npmjs.org/';
export const STABLE_STAGING_TAG = 'release';
export const REGISTRY_VERIFY_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000];
export const RELEASE_PACKAGE_NAMES = [
  'xrpl-connect',
  '@xrpl-commons/xrpl-connect-react',
  '@xrpl-commons/xrpl-connect-vue',
];

export const PUBLISH_CONFIG = {
  access: 'public',
  registry: NPM_REGISTRY,
  tag: 'rc',
};

export const PUBLISH_GUARD =
  "node -e \"const { npm_config_tag: tag, npm_config_access: access, npm_config_registry: registry, npm_package_version: version } = process.env; const expectedTag = /^\\d+\\.\\d+\\.\\d+-rc\\.\\d+$/.test(version) ? 'rc' : /^\\d+\\.\\d+\\.\\d+$/.test(version) ? 'release' : ''; let registryUrl = ''; try { registryUrl = new URL(registry).href; } catch {} if (!expectedTag || tag !== expectedTag || access !== 'public' || registryUrl !== 'https://registry.npmjs.org/') { console.error('Publish requires the version-matched rc/release tag, --access public, and --registry https://registry.npmjs.org/'); process.exit(1); }\"";

export function parseReleaseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/.exec(version);
  assert(match, `Unsupported coordinated release version: ${version}`);
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    rc: match[4] === undefined ? null : Number(match[4]),
  };
}

function compareReleaseVersions(leftVersion, rightVersion) {
  const left = parseReleaseVersion(leftVersion);
  const right = parseReleaseVersion(rightVersion);
  for (const field of ['major', 'minor', 'patch']) {
    if (left[field] !== right[field]) return left[field] < right[field] ? -1 : 1;
  }
  if (left.rc === right.rc) return 0;
  if (left.rc === null) return 1;
  if (right.rc === null) return -1;
  return left.rc < right.rc ? -1 : 1;
}

export function createReleaseConfig(version, channel) {
  const parsedVersion = parseReleaseVersion(version);
  assert(['rc', 'stable'].includes(channel), `Unsupported release channel: ${channel}`);
  assert.equal(
    channel,
    parsedVersion.rc === null ? 'stable' : 'rc',
    `${version} is not a ${channel} release version`
  );
  return {
    version,
    channel,
    publishTag: channel === 'rc' ? 'rc' : STABLE_STAGING_TAG,
    finalTag: channel === 'rc' ? 'rc' : 'latest',
  };
}

function assertKnownPackages(tagsByPackage) {
  assert.deepEqual(
    Object.keys(tagsByPackage).sort(),
    [...RELEASE_PACKAGE_NAMES].sort(),
    'Registry state must contain exactly the coordinated packages'
  );
}

function assertAllowedTagNames(packageName, tags, channel) {
  const allowed = new Set(['latest', 'rc']);
  if (channel === 'stable') allowed.add(STABLE_STAGING_TAG);
  const unexpected = Object.keys(tags).filter((tag) => !allowed.has(tag));
  assert.deepEqual(unexpected, [], `${packageName} has unexpected dist-tags`);
}

function assertPreviousLatest(packageName, latest, config) {
  if (latest === undefined) return;
  const comparison = compareReleaseVersions(latest, config.version);
  if (config.channel === 'stable' && comparison === 0) return;
  assert(comparison < 0, `${packageName}@latest must precede ${config.version}`);
}

function assertCompatibleRc(packageName, rcVersion, config) {
  if (rcVersion === undefined) return;
  const rc = parseReleaseVersion(rcVersion);
  const candidate = parseReleaseVersion(config.version);
  assert.notEqual(rc.rc, null, `${packageName}@rc must point to a release candidate`);
  if (config.channel === 'stable') {
    assert.deepEqual(
      [rc.major, rc.minor, rc.patch],
      [candidate.major, candidate.minor, candidate.patch],
      `${packageName}@rc must belong to the ${candidate.major}.${candidate.minor}.${candidate.patch} release`
    );
  }
  assert(
    compareReleaseVersions(rcVersion, config.version) <= 0,
    `${packageName}@rc cannot be newer than ${config.version}`
  );
}

export function assertDocumentedReleaseSpecs(dependencies, config, context) {
  let releaseSpecCount = 0;
  for (const dependency of dependencies) {
    const packageName = RELEASE_PACKAGE_NAMES.find(
      (name) => dependency === name || dependency.startsWith(`${name}@`)
    );
    if (!packageName) continue;

    releaseSpecCount += 1;
    const expected = config.channel === 'rc' ? `${packageName}@rc` : packageName;
    assert.equal(
      dependency,
      expected,
      `${context} must install ${expected} for the ${config.channel} channel`
    );
  }
  return releaseSpecCount;
}

export function assertSafePrepublishRegistryState(tagsByPackage, config) {
  assertKnownPackages(tagsByPackage);
  const snapshot = {};

  for (const packageName of RELEASE_PACKAGE_NAMES) {
    const tags = tagsByPackage[packageName];
    if (tags === null) {
      snapshot[packageName] = { latest: null, rc: null };
      continue;
    }
    assertAllowedTagNames(packageName, tags, config.channel);
    assertPreviousLatest(packageName, tags.latest, config);
    assertCompatibleRc(packageName, tags.rc, config);
    if (config.channel === 'stable') {
      assert(
        tags[STABLE_STAGING_TAG] === undefined || tags[STABLE_STAGING_TAG] === config.version,
        `${packageName}@${STABLE_STAGING_TAG} must be absent or point to ${config.version}`
      );
    }
    snapshot[packageName] = {
      latest: tags.latest ?? null,
      rc: tags.rc ?? null,
    };
  }

  return snapshot;
}

export function assertStagedRegistryState(tagsByPackage, config, prepublishSnapshot) {
  assert.equal(config.channel, 'stable', 'Only stable releases use a staging tag');
  assertKnownPackages(tagsByPackage);

  for (const packageName of RELEASE_PACKAGE_NAMES) {
    const tags = tagsByPackage[packageName];
    assert(tags, `${packageName} must exist after staging`);
    assertAllowedTagNames(packageName, tags, config.channel);
    assert.equal(
      tags[STABLE_STAGING_TAG],
      config.version,
      `${packageName}@${STABLE_STAGING_TAG} must point to ${config.version}`
    );
    assert.equal(
      tags.rc ?? null,
      prepublishSnapshot[packageName].rc,
      `${packageName}@rc changed during stable staging`
    );
    const previousLatest = prepublishSnapshot[packageName].latest;
    assert(
      tags.latest === config.version || (tags.latest ?? null) === previousLatest,
      `${packageName}@latest changed before coordinated promotion`
    );
  }
}

export function assertCompleteRegistryState(tagsByPackage, config, prepublishSnapshot = null) {
  assertKnownPackages(tagsByPackage);

  for (const packageName of RELEASE_PACKAGE_NAMES) {
    const tags = tagsByPackage[packageName];
    assert(tags, `${packageName} must exist after publication`);
    assertAllowedTagNames(packageName, tags, config.channel);
    if (config.channel === 'rc') {
      assert.equal(tags.rc, config.version, `${packageName}@rc must point to ${config.version}`);
      if (prepublishSnapshot) {
        assert.equal(
          tags.latest ?? null,
          prepublishSnapshot[packageName].latest,
          `${packageName}@latest changed during RC publication`
        );
      } else {
        assertPreviousLatest(packageName, tags.latest, config);
      }
      continue;
    }

    assert.equal(
      tags.latest,
      config.version,
      `${packageName}@latest must point to ${config.version}`
    );
    assert.equal(
      tags[STABLE_STAGING_TAG],
      undefined,
      `${packageName}@${STABLE_STAGING_TAG} must be removed after promotion`
    );
    if (prepublishSnapshot) {
      assert.equal(
        tags.rc ?? null,
        prepublishSnapshot[packageName].rc,
        `${packageName}@rc changed during stable promotion`
      );
    } else {
      assertCompatibleRc(packageName, tags.rc, config);
    }
  }
}
