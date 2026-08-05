# 프로젝트 setup 마법사

`create-vibe-start`로 만든 프로젝트는 생성 시점에 배포를 건너뛰어도 나중에 GitHub, Vercel, iOS, Android, Codemagic을 연결할 수 있습니다.

## 실행

생성된 프로젝트 루트에서 실행합니다.

```bash
pnpm run setup
```

프로젝트의 `setup` 스크립트는 프로젝트를 생성한 `create-vibe-start`의 정확한 버전을 실행합니다. 새 CLI 버전에서 동작이 바뀌어도 기존 프로젝트의 설정 흐름이 갑자기 달라지지 않습니다.

마법사는 다음 작업을 제공합니다.

- `전체 설정`: GitHub, Vercel, 모바일 배포 준비를 순서대로 진행합니다.
- `GitHub 연결`: 새 저장소를 만들거나 기존 저장소를 연결합니다.
- `Vercel 연결 및 배포`: GitHub 저장소를 연결하고 운영 환경을 배포합니다.
- `모바일 배포 준비`: iOS와 Android 식별자를 적용하고 Codemagic을 연결합니다.
- `Codemagic 빌드 실행`: 저장된 설정으로 모바일 릴리스 워크플로를 시작합니다.
- `현재 설정 점검`: 각 서비스의 연결 상태를 읽기 전용으로 확인합니다.

중간에 취소하거나 웹 콘솔 작업이 남아 있어도 `pnpm run setup`을 다시 실행해 필요한 항목만 이어서 설정할 수 있습니다.

## 사용자가 준비할 것

| 대상      | 준비 사항                                                      | 마법사에서 입력하거나 확인할 값                    |
| --------- | -------------------------------------------------------------- | -------------------------------------------------- |
| GitHub    | GitHub 계정                                                    | 새 저장소의 공개 범위 또는 기존 `owner/repository` |
| Vercel    | Vercel 계정과 GitHub 접근 권한                                 | 생성하거나 재사용할 프로젝트 연결 상태             |
| iOS       | Apple Developer Program, Explicit App ID, App Store Connect 앱 | `com.example.myapp` 형식의 Bundle ID               |
| Android   | 인증된 Google Play Console 개발자 계정과 앱                    | `com.example.myapp` 형식의 Package Name            |
| Codemagic | GitHub 저장소가 연결된 Codemagic 계정과 API token              | Codemagic Application ID, 실행할 플랫폼            |

계정 가입과 앱 생성은 Apple, Google Play, Codemagic 웹 콘솔에서 완료해야 합니다. 마법사는 해당 단계에서 필요한 링크와 체크리스트를 표시합니다. 생성된 프로젝트의 `docs/deployment-setup.md`에는 실제 사용자 기준의 전체 준비 순서가 포함됩니다.

## 저장되는 값과 비밀값

저장소에 기록되는 `vibe-start.config.json`에는 다음 비밀이 아닌 식별자만 들어갑니다.

- iOS Bundle ID
- Android Package Name
- Codemagic Application ID

Codemagic API token은 `CODEMAGIC_API_TOKEN` 환경 변수 또는 마스킹된 입력으로 받고 파일에 저장하지 않습니다. Apple 인증 정보, Android keystore, Google Play 서비스 계정 JSON은 Codemagic에 저장하며 저장소에 커밋하지 않습니다. Vercel 운영 비밀값과 Turso 인증 정보도 Vercel 환경에 설정합니다.

## 개발 중인 CLI로 검증

정식 생성 프로젝트는 생성 당시 npm 버전을 사용합니다. npm에 아직 배포하지 않은 현재 소스를 검증할 때는 루트 개발 명령이 CLI를 build하고 tarball로 pack한 뒤 생성 프로젝트에 포함합니다.

```bash
pnpm dev
```

이 경로로 만든 개발 프로젝트의 `pnpm run setup`은 `.vibe-start/create-vibe-start.tgz`를 사용합니다. 일반 사용자 프로젝트에는 이 파일이 포함되지 않습니다.

CI와 같은 비대화형 전체 검증은 다음 명령으로 실행합니다.

```bash
pnpm verify:local-setup
```

이 명령은 build → pack → 프로젝트 생성 → 의존성 설치 → `pnpm run setup --check`를 순서대로 검증합니다.

## 문제 해결

- 생성된 프로젝트 루트가 아닌 곳에서 실행하면 `package.json`과 `apps/main-app/package.json` 확인 단계에서 중단됩니다.
- 현재 상태가 불분명하면 `현재 설정 점검`을 먼저 실행하세요.
- Vercel 설정이 일부만 완료된 경우 필요한 값을 유지한 채 `Vercel 연결 및 배포`를 다시 실행할 수 있습니다.
- 모바일 ID는 소문자 reverse-domain 형식이어야 합니다. 예: `com.example.myapp`.
- Google Play는 첫 앱 버전을 수동으로 업로드해야 자동 트랙 배포가 가능할 수 있습니다.
- Codemagic token을 반복해서 입력하지 않으려면 현재 셸에만 `CODEMAGIC_API_TOKEN`을 설정한 뒤 마법사를 실행하세요.
