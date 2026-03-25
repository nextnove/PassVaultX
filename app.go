package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"passvaultx/internal/config"
	"passvaultx/internal/i18n"
	"passvaultx/internal/models"
	"passvaultx/internal/services"
	"passvaultx/internal/updater"
	"passvaultx/internal/vault"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/xuri/excelize/v2"
)

// App struct
type App struct {
	ctx            context.Context
	vaultManager   *vault.VaultManager
	clipboardLock  sync.Mutex
	clipboardTimer *time.Timer
	appName        string
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		appName: config.AppID,
	}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	env := runtime.Environment(ctx)

	// Initialize i18n
	execPath, _ := os.Executable()
	localesDir := filepath.Join(filepath.Dir(execPath), "internal", "i18n", "locales")
	// For dev mode or if missing in exec dir, try relative to project root
	if _, err := os.Stat(localesDir); os.IsNotExist(err) {
		localesDir = filepath.Join("internal", "i18n", "locales")
	}
	_ = i18n.LoadLocales(localesDir)

	// Register event listeners
	runtime.EventsOn(ctx, "window-blur", func(optionalData ...interface{}) {
		cfg, err := a.GetConfig()
		if err == nil && cfg.LockOnDeactivate {
			_ = a.LockVault()
			runtime.EventsEmit(a.ctx, "vault-locked")
		}
	})

	a.appName = config.AppID
	if env.BuildType == "dev" {
		a.appName = config.AppIDDev
	}

	vm, err := vault.NewVaultManager(a.appName)
	if err != nil {
		fmt.Printf("Error initializing VaultManager: %v\n", err)
	}
	a.vaultManager = vm

	if env.BuildType == "dev" {
		runtime.WindowSetTitle(ctx, config.AppName+" (Dev Mode)")
	}
}

// beforeClose is called when the application is about to close
func (a *App) beforeClose(ctx context.Context) bool {
	_ = a.ClearClipboard()
	return false // returning true will prevent close
}

// ------------------- Vault Operations ------------------- //

func (a *App) CreateVault(masterPassword string) error {
	cfg, err := a.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}
	algo := cfg.KeyDerivationAlgorithm
	if algo == "" {
		algo = "pbkdf2"
	}
	return a.vaultManager.CreateVault(masterPassword, algo)
}

func (a *App) UnlockVault(masterPassword string) (*models.Vault, error) {
	return a.vaultManager.UnlockVault(masterPassword)
}

func (a *App) ChangeMasterPassword(oldPassword, newPassword string) error {
	err := a.vaultManager.ChangeMasterPassword(oldPassword, newPassword)
	if err == nil {
		// [I-6] Force re-login so the user verifies the new password immediately
		_ = a.vaultManager.LockVault()
		runtime.EventsEmit(a.ctx, "vault-locked")
	}
	return err
}

func (a *App) LockVault() error {
	_ = a.ClearClipboard()
	return a.vaultManager.LockVault()
}

func (a *App) GetVaultState() string {
	return a.vaultManager.GetVaultState()
}

// OnSuspend is called when the OS goes to sleep
func (a *App) OnSuspend() {
	_ = a.LockVault()
	runtime.EventsEmit(a.ctx, "vault-locked")
}

func (a *App) VaultExists() bool {
	return a.vaultManager.VaultExists()
}

// ------------------- Item Operations ------------------- //

func (a *App) AddPasswordItem(item models.NewPasswordItem) (*models.PasswordItem, error) {
	return a.vaultManager.AddPasswordItem(item)
}

func (a *App) UpdatePasswordItem(id string, updates map[string]interface{}) (*models.PasswordItem, error) {
	return a.vaultManager.UpdatePasswordItem(id, updates)
}

func (a *App) DeletePasswordItem(id string) error {
	return a.vaultManager.DeletePasswordItem(id)
}

func (a *App) GetPasswordItem(id string) (*models.PasswordItem, error) {
	return a.vaultManager.GetPasswordItem(id)
}

func (a *App) GetAllPasswordItems() ([]models.PasswordItem, error) {
	return a.vaultManager.GetAllPasswordItems()
}

func (a *App) TrackUsage(id string) error {
	return a.vaultManager.TrackUsage(id)
}

// ------------------- Category Operations ------------------- //

func (a *App) AddCategory(name string) (*models.Category, error) {
	return a.vaultManager.AddCategory(name)
}

func (a *App) UpdateCategory(id string, name string) (*models.Category, error) {
	return a.vaultManager.UpdateCategory(id, name)
}

func (a *App) DeleteCategory(id string) error {
	err := a.vaultManager.DeleteCategory(id)
	if err != nil {
		if err.Error() == "category is in use" {
			return errors.New(i18n.T(a.GetLanguage(), "error_category_in_use"))
		}
		return err
	}
	return nil
}

func (a *App) GetAllCategories() ([]models.Category, error) {
	return a.vaultManager.GetAllCategories()
}

func (a *App) ReorderCategories(categoryIds []string) error {
	return a.vaultManager.ReorderCategories(categoryIds)
}

// ------------------- Utility Operations ------------------- //

func (a *App) GeneratePassword(opts services.PasswordOptions) (*services.PasswordGenerationResult, error) {
	return services.GeneratePassword(opts)
}

// ------------------- Clipboard Operations ------------------- //

func (a *App) CopyToClipboard(text string, autoDeleteSeconds int) error {
	err := runtime.ClipboardSetText(a.ctx, text)
	if err != nil {
		return err
	}

	a.clipboardLock.Lock()
	defer a.clipboardLock.Unlock()

	if a.clipboardTimer != nil {
		a.clipboardTimer.Stop()
	}

	if autoDeleteSeconds > 0 {
		a.clipboardTimer = time.AfterFunc(time.Duration(autoDeleteSeconds)*time.Second, func() {
			_ = a.ClearClipboard()
		})
	}

	return nil
}

func (a *App) ClearClipboard() error {
	return runtime.ClipboardSetText(a.ctx, "")
}

// ------------------- Config Operations ------------------- //

func (a *App) getConfigPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		home, err := os.UserHomeDir()
		if err != nil {
			configDir = "."
		} else {
			configDir = home
		}
	}

	appDir := filepath.Join(configDir, config.AppID)
	if isDev {
		appDir = filepath.Join(configDir, config.AppIDDev)
	}

	os.MkdirAll(appDir, 0755)
	return filepath.Join(appDir, "config.json")
}

func (a *App) GetConfig() (models.AppConfig, error) {
	configPath := a.getConfigPath()
	var cfg models.AppConfig

	defaultConfig := models.AppConfig{
		Theme:                      "system",
		AutoLockMinutes:            5,
		ClipboardAutoDeleteSeconds: 30,
		KeyDerivationAlgorithm:     "pbkdf2",
		Language:                   "ko",
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return defaultConfig, nil
	}

	if err := json.Unmarshal(data, &cfg); err != nil {
		return defaultConfig, nil
	}
	// [I-5] Enforce safe value ranges to prevent config manipulation attacks
	if cfg.AutoLockMinutes < 0 { cfg.AutoLockMinutes = 0 }
	if cfg.ClipboardAutoDeleteSeconds < 0 { cfg.ClipboardAutoDeleteSeconds = 0 }
	if cfg.ClipboardAutoDeleteSeconds > 300 { cfg.ClipboardAutoDeleteSeconds = 300 }
	return cfg, nil
}

func (a *App) UpdateConfig(updates models.AppConfig) (models.AppConfig, error) {
	configPath := a.getConfigPath()
	data, err := json.MarshalIndent(updates, "", "  ")
	if err != nil {
		return updates, err
	}
	err = os.WriteFile(configPath, data, 0644)
	return updates, err
}

func (a *App) ResetConfig() (models.AppConfig, error) {
	defaultConfig := models.AppConfig{
		Theme:                      "system",
		AutoLockMinutes:            5,
		ClipboardAutoDeleteSeconds: 30,
		KeyDerivationAlgorithm:     "pbkdf2",
		Language:                   "ko",
		LockOnDeactivate:           false,
	}
	return a.UpdateConfig(defaultConfig)
}

func (a *App) SyncConfig(cfg models.AppConfig) (models.AppConfig, error) {
	updated, err := a.UpdateConfig(cfg)
	if err == nil {
		runtime.EventsEmit(a.ctx, "config-updated", updated)
	}
	return updated, err
}

func (a *App) GetLanguage() string {
	cfg, err := a.GetConfig()
	if err != nil || cfg.Language == "" {
		return "ko"
	}
	return cfg.Language
}

func (a *App) SetLanguage(lang string) error {
	cfg, err := a.GetConfig()
	if err != nil {
		return err
	}
	cfg.Language = lang
	_, err = a.UpdateConfig(cfg)
	return err
}

func (a *App) ExportBackup() error {
	lang := a.GetLanguage()
	// 1. Check if vault exists
	if !a.vaultManager.VaultExists() {
		return errors.New(i18n.T(lang, "error_vault_not_exists"))
	}

	title := i18n.T(lang, "msg_save_backup")

	destPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           title,
		DefaultFilename: fmt.Sprintf("passvaultx_backup_%s.db", time.Now().Format("20060102_150405")),
		Filters: []runtime.FileFilter{
			{DisplayName: "SQLite Database (*.db)", Pattern: "*.db"},
			{DisplayName: "All Files", Pattern: "*.*"},
		},
	})
	if err != nil {
		return err
	}
	if destPath == "" {
		return errors.New(i18n.T(lang, "error_cancel"))
	}

	if err := a.vaultManager.Backup(destPath); err != nil {
		return fmt.Errorf(i18n.T(lang, "error_backup_export_failed"), err)
	}

	return nil
}

func (a *App) ImportBackup(password string) error {
	lang := a.GetLanguage()
	title := i18n.T(lang, "msg_select_backup")

	srcPath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
		Filters: []runtime.FileFilter{
			{DisplayName: "Vault Backup (*.db;*.enc)", Pattern: "*.db;*.enc"},
			{DisplayName: "All Files", Pattern: "*.*"},
		},
	})
	if err != nil {
		return err
	}
	if srcPath == "" {
		return errors.New(i18n.T(lang, "error_cancel"))
	}

	data, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf(i18n.T(lang, "error_backup_read_failed"), err)
	}

	// Verify the backup with the provided password before overwriting
	if err := a.vaultManager.VerifyBackup(data, password); err != nil {
		return err
	}

	// Determine if it's legacy or new
	var vaultFile models.VaultFile
	isLegacy := json.Unmarshal(data, &vaultFile) == nil && vaultFile.Ciphertext != ""

	vaultPath := a.vaultManager.GetVaultFilePath() // vault.db
	legacyPath := filepath.Join(filepath.Dir(vaultPath), "vault.enc")

	// 1. Lock the vault first to close the database connection
	if err := a.vaultManager.LockVault(); err != nil {
		fmt.Printf("Warning: failed to lock vault before import: %v\n", err)
	}

	// 2. Remove any lingering WAL/SHM files and the existing DB
	os.Remove(vaultPath)
	os.Remove(vaultPath + "-wal")
	os.Remove(vaultPath + "-shm")

	if isLegacy {
		// Import as vault.enc to trigger migration on next unlock
		if err := os.WriteFile(legacyPath, data, 0600); err != nil {
			return err
		}
	} else {
		// Import directly as vault.db
		if err := os.WriteFile(vaultPath, data, 0600); err != nil {
			return err
		}
	}

	// 3. Emit lock event to redirect to login
	runtime.EventsEmit(a.ctx, "vault-locked")

	return nil
}

func (a *App) ExportToExcel() error {
	lang := a.GetLanguage()
	items, err := a.vaultManager.GetAllPasswordItems()
	if err != nil {
		return fmt.Errorf(i18n.T(lang, "error_excel_read_failed"), err)
	}

	categories, err := a.vaultManager.GetAllCategories()
	if err != nil {
		fmt.Printf("Warning: failed to get categories for Excel export: %v\n", err)
	}
	categoryMap := make(map[string]string)
	for _, cat := range categories {
		categoryMap[cat.ID] = cat.Name
	}

	title := i18n.T(lang, "msg_export_excel")

	destPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           title,
		DefaultFilename: fmt.Sprintf("passvaultx_export_%s.xlsx", time.Now().Format("20060102_150405")),
		Filters: []runtime.FileFilter{
			{DisplayName: "Excel Files (*.xlsx)", Pattern: "*.xlsx"},
			{DisplayName: "All Files", Pattern: "*.*"},
		},
	})
	if err != nil {
		return err
	}
	if destPath == "" {
		return errors.New(i18n.T(lang, "error_cancel"))
	}

	f := excelize.NewFile()
	defer f.Close()

	sheet := i18n.T(lang, "excel_sheet_name")
	_ = f.SetSheetName("Sheet1", sheet)

	headers := []string{
		i18n.T(lang, "excel_header_title"),
		i18n.T(lang, "excel_header_username"),
		i18n.T(lang, "excel_header_password"),
		i18n.T(lang, "excel_header_url"),
		i18n.T(lang, "excel_header_notes"),
		i18n.T(lang, "excel_header_category"),
		i18n.T(lang, "excel_header_favorite"),
		i18n.T(lang, "excel_header_created_at"),
	}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}

	style, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true},
	})
	_ = f.SetRowStyle(sheet, 1, 1, style)

	for rowIdx, item := range items {
		row := rowIdx + 2
		catName := categoryMap[item.CategoryID]
		if catName == "" {
			catName = i18n.T(lang, "excel_category_other")
		}
		values := []interface{}{
			item.Title,
			item.Username,
			item.Password,
			item.URL,
			item.Notes,
			catName,
			item.Favorite,
			item.CreatedAt,
		}
		for colIdx, val := range values {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, row)
			_ = f.SetCellValue(sheet, cell, val)
		}
	}

	for i := range headers {
		col, _ := excelize.ColumnNumberToName(i + 1)
		_ = f.SetColWidth(sheet, col, col, 22)
	}

	if err := f.SaveAs(destPath); err != nil {
		if lang == "en" {
			return fmt.Errorf("failed to save Excel file: %w", err)
		}
		return fmt.Errorf("Excel 파일 저장 실패: %w", err)
	}

	return nil
}

func (a *App) StartUpdate(url string) error {
	return updater.RunInstaller(url)
}