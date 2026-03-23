package models

import "time"

// VaultFile represents the structure of the saved vault.enc file
type VaultFile struct {
	Version       string `json:"version"`
	KeyDerivation string                 `json:"keyDerivation,omitempty"`
	KDFParams     map[string]interface{} `json:"kdfParams,omitempty"`
	Salt          string                 `json:"salt"`
	IV            string `json:"iv"`
	AuthTag       string `json:"authTag"`
	Ciphertext    string `json:"ciphertext"`
}

// Vault represents the unencrypted vault data
type Vault struct {
	Version    string         `json:"version"`
	Items      []PasswordItem `json:"items"`
	Categories []Category     `json:"categories"`
	CreatedAt  string         `json:"createdAt"`
	UpdatedAt  string         `json:"updatedAt"`
}

// PasswordItem represents a single stored credential
type PasswordItem struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Username  string `json:"username,omitempty"`
	Password  string `json:"password"`
	URL       string `json:"url,omitempty"`
	Notes     string `json:"notes,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Favorite  bool   `json:"favorite"`
	CategoryID string `json:"categoryId,omitempty"`
	LastUsedAt string `json:"lastUsedAt,omitempty"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// Category represents a folder/tag for organizing items
type Category struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// NewPasswordItem is used when receiving frontend data
type NewPasswordItem struct {
	Title      string `json:"title"`
	Username   string `json:"username,omitempty"`
	Password   string `json:"password"`
	URL       string `json:"url,omitempty"`
	Notes     string `json:"notes,omitempty"`
	Tags      []string `json:"tags,omitempty"`
	Favorite   bool   `json:"favorite,omitempty"`
	CategoryID string `json:"categoryId,omitempty"`
}

// NewCategory is used when receiving frontend data
type NewCategory struct {
	Name string `json:"name"`
}

// AppConfig represents application settings
type AppConfig struct {
	Theme                      string `json:"theme"`
	AutoLockMinutes            int    `json:"autoLockMinutes"`
	ClipboardAutoDeleteSeconds int    `json:"clipboardAutoDeleteSeconds"`
	KeyDerivationAlgorithm     string `json:"keyDerivationAlgorithm"`
	Language                   string `json:"language"`
	LockOnDeactivate           bool   `json:"lockOnDeactivate"`
}

func GetCurrentTimeISO() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}
