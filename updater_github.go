//go:build !winstore

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"passvaultx/internal/config"
)

type GithubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

func CheckForUpdates() {
	repo := "nextnove/PassVaultX"
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", repo)

	resp, err := http.Get(url)
	if err != nil || resp.StatusCode != 200 { return }
	defer resp.Body.Close()

	var release GithubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil { return }

	// 버전 비교 (v1.0.0 != v1.0.1)
	if release.TagName == config.AppVersion { return }

	// 설치 파일 찾기
	var downloadURL string
	for _, asset := range release.Assets {
		if asset.Name == "PassVaultX_Installer.exe" {
			downloadURL = asset.BrowserDownloadURL
			break
		}
	}

	if downloadURL != "" {
		runInstallerUpdate(downloadURL)
	}
}

func runInstallerUpdate(url string) {
	// 1. 임시 폴더에 다운로드
	tempPath := filepath.Join(os.TempDir(), "PassVaultX_Update.exe")
	
	out, err := os.Create(tempPath)
	if err != nil { return }
	defer out.Close()

	resp, err := http.Get(url)
	if err != nil { return }
	defer resp.Body.Close()

	io.Copy(out, resp.Body)
	out.Close() // 실행 전 파일을 닫아야 함

	// 2. 설치 프로그램 실행
	// NSIS 설치 프로그램은 실행 시 UAC(관리자 권한)를 스스로 요청하므로 안전.
	cmd := exec.Command(tempPath)
	if err := cmd.Start(); err != nil {
		fmt.Println("설치 파일 실행 실패:", err)
		return
	}

	// 3. 현재 앱 종료 (설치 프로그램이 파일을 덮어쓸 수 있게 함)
	os.Exit(0)
}