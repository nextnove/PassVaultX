package db

import (
	"fmt"
	"strconv"
)

type MigrationManager struct {
	db *Database
}

func NewMigrationManager(db *Database) *MigrationManager {
	return &MigrationManager{db: db}
}

// CurrentVersion returns the current schema version from metadata
func (m *MigrationManager) CurrentVersion() (int, error) {
	val, err := m.db.GetMetadata("schema_version")
	if err != nil {
		return 0, err
	}
	if val == "" {
		return 0, nil
	}
	return strconv.Atoi(val)
}

// SetVersion updates the schema version in metadata
func (m *MigrationManager) SetVersion(version int) error {
	return m.db.SetMetadata("schema_version", strconv.Itoa(version))
}

// MigrationStatus returns the current migration status (e.g., 'pending_verification')
func (m *MigrationManager) MigrationStatus() (string, error) {
	return m.db.GetMetadata("migration_status")
}

// SetMigrationStatus updates the migration status
func (m *MigrationManager) SetMigrationStatus(status string) error {
	return m.db.SetMetadata("migration_status", status)
}

// ApplyMigrations applies sequential schema updates
func (m *MigrationManager) ApplyMigrations() error {
	current, err := m.CurrentVersion()
	if err != nil {
		return err
	}

	// Future migrations will be added here
	// Example:
	// if current < 2 {
	//    if err := m.migrateToV2(); err != nil { return err }
	//    current = 2
	//    m.SetVersion(current)
	// }

	_ = current // Use the variable to satisfy compiler for now
	return nil
}

// VerifyIntegrity checks if the database is functional by trying to read a sample count
func (m *MigrationManager) VerifyIntegrity() error {
	var count int
	// Simple check to see if tables are readable
	err := m.db.Conn.QueryRow("SELECT COUNT(*) FROM items").Scan(&count)
	if err != nil {
		return fmt.Errorf("integrity check failed: items table unreadable: %w", err)
	}
	
	err = m.db.Conn.QueryRow("SELECT COUNT(*) FROM categories").Scan(&count)
	if err != nil {
		return fmt.Errorf("integrity check failed: categories table unreadable: %w", err)
	}

	return nil
}
