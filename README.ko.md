[English Version](./README.md)

# PassVaultX

![Wails](https://img.shields.io/badge/Wails-v2-red?style=flat-square&logo=go)
![React](https://img.shields.io/badge/React-v19-blue?style=flat-square&logo=react)
![Go](https://img.shields.io/badge/Go-1.21+-blue?style=flat-square&logo=go)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwind-css)

**PassVaultX**는 Wails 프레임워크를 기반으로 제작된 안전하고 사용하기 쉬운 데스크톱 비밀번호 관리 매니저입니다. 강력한 보안 기능과 직관적인 UI를 제공하여 사용자의 소중한 계정 정보를 안전하게 보호합니다.

## ✨ 주요 기능

- **🔐 보안 볼트 (Security Vault)**: 마스터 비밀번호를 사용하여 계정 정보를 암호화하고 보호합니다. PBKDF2 알고리즘을 지원하며, 일정 시간 미사용 시 자동 잠금 기능을 제공합니다.
- **📋 계정 관리**: 계정 정보를 추가, 수정, 삭제 및 카테고리별로 분류하여 관리할 수 있습니다.
- **🎲 비밀번호 생성기**: 사용자가 정의한 옵션(길이, 영문, 숫자, 특수문자 등)에 따라 강력한 보안 비밀번호를 생성합니다.
- **📱 클립보드 자동 삭제**: 비밀번호 복사 후 설정된 시간이 지나면 클립보드 내용을 자동으로 삭제하여 보안을 강화합니다.
- **📂 백업 및 복구**: 암호화된 백업 파일(.enc)을 생성하거나 가져올 수 있어 계정 정보를 안전하게 관리할 수 있습니다.
- **📊 엑셀 내보내기**: 저장된 계정 목록을 Excel 파일(.xlsx)로 편리하게 내보낼 수 있습니다.
- **🌐 다국어 지원**: 한국어와 영어를 모두 지원하며, 설정에서 간편하게 변경 가능합니다.
- **🎨 테마 지원**: 시스템 설정에 따른 자동 테마 및 다크/라이트 모드를 지원합니다.

## 🛠 기술 스택

- **Backend**: [Go](https://go.dev/) (Wails v2)
- **Frontend**: [React v19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **Internationalization**: [i18next](https://www.i18next.com/)

## 🚀 시작하기

### 사전 요구 사항

- [Go](https://go.dev/dl/) 1.21 이상
- [Node.js](https://nodejs.org/) 18 이상 및 npm
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) 설치:
  ```bash
  go install github.com/wailsapp/wails/v2/cmd/wails@latest
  ```

### 개발 모드 실행

프로젝트 루트 디렉토리에서 다음 명령을 실행합니다:
```bash
wails dev
```

### 빌드 및 실행 파일 생성

Windows용 실행 파일(.exe)을 생성하려면 다음 명령을 실행합니다:
```bash
wails build
```
빌드된 파일은 `build/bin` 디렉토리에서 확인할 수 있습니다.

## 📸 스크린샷

*(이곳에 애플리케이션 스크린샷을 추가해 주세요)*

## 📄 라이선스

이 프로젝트는 MIT 라이선스(공용 조항 포함) 에 따라 배포됩니다 .

본 소프트웨어는 비상업적 목적으로 자유롭게 사용, 수정 및 배포할 수 있습니다. 상업적 용도(소프트웨어 판매 또는 이를 기반으로 한 유료 서비스 제공)를 위해서는 저작권자로부터 상업용 라이선스를 취득해야 합니다.

자세한 내용은 [LICENSE](LICENSE) 파일을 참조하십시오.

---
**Author**: [nextnove](mailto:nextnove.com@gmail.com)
