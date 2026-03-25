//go:build winstore

package updater

import "context"

func internalCheck(ctx context.Context, currentVersion string) {
	// Windows Store 빌드에서는 자동 업데이트를 지원하므로 아무것도 하지 않음
}

func RunInstaller(url string) error {
	// Windows Store 빌드에서는 호출되지 않음
	return nil
}
