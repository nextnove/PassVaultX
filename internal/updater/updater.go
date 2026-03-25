package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	GithubOwner = "nextnove"
	GithubRepo  = "PassVaultX"
	InstallerName = "PassVaultX_Installer.exe"
	PortableName  = "PassVaultX.exe"
)

type GitHubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

// Check는 빌드 태그에 따라 업데이트 확인 여부를 결정합니다.
func Check(ctx context.Context, currentVersion string) {
	// 실제 업데이트 확인 로직은 updater_github.go / updater_store.go에서 구현된 
	// internalCheck를 호출합니다.
	go internalCheck(ctx, currentVersion)
}

func sendUpdateEvent(ctx context.Context, latestVersion, installerURL, portableURL string) {
	runtime.EventsEmit(ctx, "update-available", map[string]string{
		"latestVersion": latestVersion,
		"installerUrl":  installerURL,
		"portableUrl":   portableURL,
	})
}

func getLatestRelease() (*GitHubRelease, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", GithubOwner, GithubRepo)
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status: %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}
	return &release, nil
}