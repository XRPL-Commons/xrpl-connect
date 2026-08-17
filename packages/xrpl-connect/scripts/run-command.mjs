import crossSpawn from 'cross-spawn';

/** Create a command runner with argv preserved across platform command shims. */
export function createCommandRunner(spawnSync) {
  return function run(command, args, options = {}) {
    const capturesOutput = options.capture || options.captureResult;
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      encoding: 'utf-8',
      env: { ...process.env, ...options.env },
      stdio: capturesOutput ? 'pipe' : 'inherit',
    });

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
      throw new Error(
        `${command} ${args.join(' ')} failed with exit code ${result.status}\n${output}`
      );
    }

    if (options.captureResult) {
      return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
    }
    return result.stdout;
  };
}

export const run = createCommandRunner(crossSpawn.sync);
