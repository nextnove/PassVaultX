package db

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	_ "modernc.org/sqlite"
	"golang.org/x/crypto/hkdf"
)

const (
	SchemaVersion = 1
	AppName       = "PassVaultX"
)

type Database struct {
	Conn *sql.DB
	path string
}

// NewDatabase initializes and open the SQLite database
func NewDatabase(dbPath string) (*Database, error) {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Apply PRAGMAs for performance and integrity
	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA foreign_keys=ON",
		"PRAGMA synchronous=NORMAL", // Faster in WAL mode
	}

	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			db.Close()
			return nil, fmt.Errorf("failed to apply pragma %s: %w", p, err)
		}
	}

	d := &Database{
		Conn: db,
		path: dbPath,
	}

	if err := d.setupSchema(); err != nil {
		db.Close()
		return nil, err
	}

	if err := d.migrateSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return d, nil
}

func (d *Database) migrateSchema() error {
	// Check and add missing columns to 'items' table
	columnsToAdd := map[string]struct {
		Type    string
		Default string
	}{
		"tags":         {Type: "TEXT", Default: "''"},
		"last_used_at": {Type: "TEXT", Default: "''"},
		"title_index":  {Type: "TEXT", Default: "''"},
	}

	for col, info := range columnsToAdd {
		if !d.columnExists("items", col) {
			query := fmt.Sprintf("ALTER TABLE items ADD COLUMN %s %s DEFAULT %s", col, info.Type, info.Default)
			if _, err := d.Conn.Exec(query); err != nil {
				return fmt.Errorf("failed to add column %s: %w", col, err)
			}
		}
	}

	// Ensure NO existing rows have NULL in these columns (for safety)
	for col := range columnsToAdd {
		query := fmt.Sprintf("UPDATE items SET %s = '' WHERE %s IS NULL", col, col)
		_, _ = d.Conn.Exec(query)
	}
	
	// Ensure index exists for title_index
	_, _ = d.Conn.Exec("CREATE INDEX IF NOT EXISTS idx_items_title_index ON items(title_index)")

	// Check and add missing columns to 'categories' table
	if !d.columnExists("categories", "sort_order") {
		if _, err := d.Conn.Exec("ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0"); err != nil {
			return fmt.Errorf("failed to add sort_order column to categories: %w", err)
		}
	}
	if !d.columnExists("categories", "updated_at") {
		if _, err := d.Conn.Exec("ALTER TABLE categories ADD COLUMN updated_at TEXT DEFAULT ''"); err != nil {
			return fmt.Errorf("failed to add updated_at column to categories: %w", err)
		}
	}

	return nil
}

func (d *Database) columnExists(table, column string) bool {
	query := fmt.Sprintf("PRAGMA table_info(%s)", table)
	rows, err := d.Conn.Query(query)
	if err != nil {
		return false
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dfltVal interface{}
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltVal, &pk); err != nil {
			return false
		}
		if name == column {
			return true
		}
	}
	return false
}

func (d *Database) setupSchema() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS metadata (
			key TEXT PRIMARY KEY,
			value TEXT,
			updated_at TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS categories (
			id TEXT PRIMARY KEY,
			name BLOB NOT NULL UNIQUE,
			sort_order INTEGER DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS items (
			id TEXT PRIMARY KEY,
			category_id TEXT,
			title BLOB NOT NULL,
			title_index TEXT,
			username BLOB,
			password BLOB,
			url BLOB,
			notes BLOB,
			tags TEXT,
			favorite INTEGER DEFAULT 0,
			last_used_at TEXT,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_items_title_index ON items(title_index)`,
	}

	for _, q := range queries {
		if _, err := d.Conn.Exec(q); err != nil {
			return fmt.Errorf("failed to execute schema query: %w", err)
		}
	}

	// [L-3] Migration: Add updated_at to metadata table if it doesn't exist
	_, _ = d.Conn.Exec("ALTER TABLE metadata ADD COLUMN updated_at TEXT")

	// Set initial schema version if not present
	var exists int
	err := d.Conn.QueryRow("SELECT COUNT(*) FROM metadata WHERE key = 'schema_version'").Scan(&exists)
	if err != nil {
		return err
	}
	if exists == 0 {
		_, err = d.Conn.Exec("INSERT INTO metadata (key, value) VALUES ('schema_version', ?)", fmt.Sprintf("%d", SchemaVersion))
		if err != nil {
			return err
		}
	}

	return nil
}

// DeriveKeys uses HKDF to derive separate encryption and indexing keys using specific salts
func DeriveKeys(masterKey []byte, encSalt []byte, indexSalt []byte) (encKey []byte, idxKey []byte, err error) {
	// [M-1] Use dedicated salt for encryption key derivation if provided
	hEnc := hkdf.New(sha256.New, masterKey, encSalt, []byte("encryption"))
	encKey = make([]byte, 32)
	if _, err := io.ReadFull(hEnc, encKey); err != nil {
		return nil, nil, err
	}

	// HKDF for indexing key (searching)
	hIdx := hkdf.New(sha256.New, masterKey, indexSalt, []byte("indexing"))
	idxKey = make([]byte, 32)
	if _, err := io.ReadFull(hIdx, idxKey); err != nil {
		return nil, nil, err
	}

	return encKey, idxKey, nil
}

// GenerateBlindIndex creates an HMAC-SHA256 of the normalized value
func GenerateBlindIndex(value string, indexKey []byte) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	h := hmac.New(sha256.New, indexKey)
	h.Write([]byte(normalized))
	return hex.EncodeToString(h.Sum(nil))
}

// Backup creates a point-in-time snapshot using VACUUM INTO
func (d *Database) Backup(destPath string) error {
	// [C-1] VACUUM INTO does not support parameter binding.
	// Validate the path to prevent SQL injection via special characters.
	if strings.Contains(destPath, "'") || strings.Contains(destPath, ";") || strings.Contains(destPath, "\\") {
		return fmt.Errorf("invalid backup path: contains illegal characters (', ;, \\)")
	}

	// Ensure destination directory exists
	dir := filepath.Dir(destPath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}

	// Delete existing backup file if it exists (VACUUM INTO fails if file exists)
	os.Remove(destPath)

	// Execute VACUUM INTO (path has been sanitized above)
	_, err := d.Conn.Exec(fmt.Sprintf("VACUUM INTO '%s'", destPath))
	return err
}

func (d *Database) Close() error {
	return d.Conn.Close()
}

func (d *Database) SetMetadata(key, value string) error {
	_, err := d.Conn.Exec("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", key, value)
	return err
}

func (d *Database) GetMetadata(key string) (string, error) {
	var value string
	err := d.Conn.QueryRow("SELECT value FROM metadata WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

func (d *Database) WithTransaction(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := d.Conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}
