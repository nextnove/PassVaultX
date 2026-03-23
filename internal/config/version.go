// internal/config/version.go 등에 정의
const CurrentVersion = "v1.0.0"

// 최신 버전 체크 (예시)
func (a *App) CheckUpdate() (string, string, error) {
    // 1. GitHub API 호출: https://api.github.com/repos/내이름/PassVaultX/releases/latest
    // 2. 응답 데이터에서 "tag_name"과 "browser_download_url" 추출
    // 3. CurrentVersion < tag_name 이면 업데이트 정보 반환
}