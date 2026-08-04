export function developmentCliArguments(
  packagePath: string,
  extraArguments: ReadonlyArray<string> = [],
): ReadonlyArray<string> {
  return [
    'exec',
    'tsx',
    'src/cli.ts',
    '--project-dir',
    './.test-project',
    '--local-setup-package',
    packagePath,
    ...extraArguments,
  ]
}
