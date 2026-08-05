# 배포 설정 사용 설명서

이 프로젝트는 처음 만들 때 배포하지 않았어도 `setup` 마법사로 GitHub, Vercel, iOS, Android, Codemagic을 나중에 연결할 수 있습니다.

## 1. 마법사 실행

프로젝트 루트에서 실행합니다.

```bash
pnpm run setup
```

처음이라면 `전체 설정`을 선택하는 것이 가장 간단합니다. 일부 설정을 이미 마쳤거나 실패한 단계부터 다시 시작하려면 필요한 메뉴만 선택하세요. 마법사는 여러 번 실행해도 됩니다.

`전체 설정`은 다음 순서로 진행됩니다.

1. GitHub 연결
2. Vercel 연결 및 배포
3. iOS와 Android 앱 식별자 설정
4. 선택적으로 Codemagic 연결과 첫 빌드 실행

## 2. GitHub 준비

필요한 것은 GitHub 계정입니다. 마법사가 GitHub CLI 설치와 로그인을 확인한 뒤 다음 중 하나를 선택하게 합니다.

- 새 저장소: 저장소 공개 범위를 선택하고 현재 프로젝트를 push합니다.
- 기존 저장소: `owner/repository`를 입력하고 현재 프로젝트를 push할지 선택합니다.

연결 결과는 로컬 Git의 `origin` remote에 저장됩니다. 기존 저장소를 선택했다면 원격의 기존 코드와 충돌하지 않는지 먼저 확인하세요.

## 3. Vercel 준비와 배포

Vercel 계정과 연결할 GitHub 저장소가 필요합니다. GitHub가 아직 연결되지 않았다면 Vercel 단계에서 GitHub 설정을 먼저 진행합니다.

마법사는 다음 작업을 이어서 수행합니다.

1. Vercel 로그인 확인
2. Vercel 프로젝트 생성 또는 연결
3. GitHub 저장소 연결
4. Vercel Marketplace의 Turso 데이터베이스 연결
5. `BETTER_AUTH_SECRET` 생성과 운영 환경 변수 설정
6. 데이터베이스 migration
7. 첫 배포
8. 모바일 앱이 사용할 운영 API 주소를 `apps/main-app/.env.mobile`에 기록

Vercel과 GitHub 사이의 저장소 접근 승인이 필요하면 브라우저에서 승인한 뒤 같은 메뉴를 다시 실행하세요.

## 4. iOS 준비

먼저 다음 항목을 준비합니다.

1. [Apple Developer Program](https://developer.apple.com/programs/)에 가입합니다.
2. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list)에서 Explicit App ID를 만듭니다.
3. [App Store Connect](https://appstoreconnect.apple.com/apps)에서 같은 Bundle ID를 사용하는 앱을 만듭니다.
4. Codemagic에 `app_store_connect`라는 이름으로 App Store Connect 연동을 만듭니다.

마법사에는 Bundle ID를 소문자 reverse-domain 형식으로 입력합니다.

```text
com.example.myapp
```

입력한 값은 iOS 프로젝트 파일에 적용되고 `vibe-start.config.json`의 `mobile.iosBundleId`에 저장됩니다.

## 5. Android 준비

먼저 다음 항목을 준비합니다.

1. [Google Play Console](https://play.google.com/console) 개발자 계정을 만들고 인증합니다.
2. Play Console에서 앱을 만듭니다.
3. Codemagic의 Code signing identities에 `android_keystore`라는 이름으로 keystore를 등록합니다.
4. Codemagic의 `google_play` 변수 그룹에 `GOOGLE_PLAY_SERVICE_ACCOUNT_CREDENTIALS`를 Secret 변수로 등록합니다.

마법사에는 Package Name을 소문자 reverse-domain 형식으로 입력합니다.

```text
com.example.myapp
```

입력한 값은 Android 프로젝트 파일에 적용되고 `vibe-start.config.json`의 `mobile.androidPackageName`에 저장됩니다. Google Play는 첫 앱 버전을 수동으로 업로드해야 이후 자동 트랙 배포가 가능할 수 있습니다.

## 6. Codemagic 연결

1. [Codemagic Apps](https://codemagic.io/apps)에서 GitHub 계정과 저장소를 연결합니다.
2. [Codemagic Account settings](https://codemagic.io/user/settings)에서 API token을 발급합니다.
3. Codemagic의 `mobile` 변수 그룹에 운영 API 주소를 `VITE_API_URL`로 등록합니다.
4. iOS 또는 Android 준비 단계의 서명·스토어 인증 정보를 등록합니다.

token은 환경 변수로 전달하면 반복 입력을 줄일 수 있습니다.

```bash
export CODEMAGIC_API_TOKEN=your-token
pnpm run setup
```

환경 변수로 전달하지 않으면 마법사가 마스킹된 입력으로 받습니다. token은 프로젝트 파일에 저장되지 않습니다.

Git `origin`이 있으면 마법사가 저장소를 Codemagic 앱으로 자동 등록합니다. 자동 등록할 수 없으면 Codemagic 앱 설정 URL의 `/app/<APPLICATION_ID>/settings`에 있는 Application ID를 입력하세요. 이 ID만 `vibe-start.config.json`에 저장됩니다.

## 7. 빌드와 스토어 전송

모바일 설정과 Codemagic 연결을 마치면 마법사에서 플랫폼을 선택해 빌드를 시작할 수 있습니다.

- `ios-release`: IPA를 빌드하고 TestFlight로 전송합니다.
- `android-release`: 서명된 Android App Bundle을 빌드하고 Google Play `internal` 트랙으로 전송합니다.

나중에 빌드만 다시 실행하려면 `pnpm run setup`에서 `Codemagic 빌드 실행`을 선택하세요. Codemagic 대시보드에서도 직접 실행할 수 있습니다.

## 8. 저장되는 값과 비밀값

저장소의 `vibe-start.config.json`에는 다음 식별자만 저장됩니다.

```json
{
  "mobile": {
    "iosBundleId": "com.example.myapp",
    "androidPackageName": "com.example.myapp"
  },
  "codemagic": {
    "applicationId": "..."
  }
}
```

다음 비밀값은 저장소에 커밋하지 않습니다.

- `CODEMAGIC_API_TOKEN`: 현재 프로세스에서만 사용
- Apple 인증 정보: Codemagic의 App Store Connect 연동에 저장
- Android keystore: Codemagic Code signing identities에 저장
- Google Play 서비스 계정 JSON: Codemagic Secret 변수에 저장
- Turso 인증 정보와 `BETTER_AUTH_SECRET`: Vercel 환경 변수에 저장

## 9. 상태 확인과 재실행

`pnpm run setup`에서 `현재 설정 점검`을 선택하면 다음 상태를 확인할 수 있습니다.

- GitHub `origin` 저장소
- `.vercel/project.json` 기준 Vercel 연결
- 저장된 iOS Bundle ID
- 저장된 Android Package Name
- Codemagic Application ID

웹 콘솔 설정이 남아 있거나 중간 단계가 실패했다면 해당 설정을 마친 뒤 같은 메뉴를 다시 실행하세요. 프로젝트 루트가 아닌 곳에서 실행하면 생성 프로젝트 확인 단계에서 중단됩니다.
