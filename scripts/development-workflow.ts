/**
 * 개발 CLI가 항상 방금 pack한 패키지를 사용하도록 공통 인자 배열을 만든다.
 * 추가 인자는 필수 개발 옵션 뒤에 붙여 기존 CLI 옵션 전달 방식을 유지한다.
 */
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
