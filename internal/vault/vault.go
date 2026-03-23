package vault

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"passvaultx/internal/crypto"
	"passvaultx/internal/db"
	"passvaultx/internal/models"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

type VaultManager struct {
	mu            sync.RWMutex
	vaultFilePath string // Path to vault.db
	legacyFilePath string // Path to vault.enc (for migration)
	userDataDir   string

	DB            *db.Database
	CurrentVault  *models.Vault // Cached for legacy compatibility
	EncKey        []byte        // AES Key derived via HKDF
	IdxKey        []byte        // HMAC Key derived via HKDF
	CurrentSalt   []byte
	KeyDerivation string
	KDFParams     map[string]interface{}
	VaultState    string // "locked", "unlocked", "creating", "error"
}

func NewVaultManager(appName string) (*VaultManager, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, err
		}
		configDir = home
	}

	userDataDir := filepath.Join(configDir, appName)
	err = os.MkdirAll(userDataDir, 0700) // Restricted permissions
	if err != nil {
		return nil, err
	}
	// [I-4] Re-apply permissions in case directory already existed with looser permissions
	_ = os.Chmod(userDataDir, 0700)

	vaultFilePath := filepath.Join(userDataDir, "vault.db")
	legacyFilePath := filepath.Join(userDataDir, "vault.enc")

	return &VaultManager{
		vaultFilePath:  vaultFilePath,
		legacyFilePath: legacyFilePath,
		userDataDir:    userDataDir,
		VaultState:     "locked",
	}, nil
}

func (v *VaultManager) CreateVault(masterPassword string, keyDerivation string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	// Ensure any open connection is closed before we try to delete files
	if v.DB != nil {
		v.DB.Close()
		v.DB = nil
	}

	// Delete existing SQLite DB files to start fresh
	os.Remove(v.vaultFilePath)
	os.Remove(v.vaultFilePath + "-wal")
	os.Remove(v.vaultFilePath + "-shm")

	if len(masterPassword) < 8 {
		return errors.New("master password must be at least 8 characters")
	}

	if keyDerivation == "" {
		keyDerivation = "pbkdf2"
	}

	v.VaultState = "creating"

	salt, err := crypto.GenerateRandomBytes(crypto.SaltLength)
	if err != nil {
		v.VaultState = "error"
		return err
	}
	v.CurrentSalt = salt
	v.KeyDerivation = keyDerivation

	var key []byte
	v.KDFParams = make(map[string]interface{})

	if keyDerivation == "scrypt" {
		v.KDFParams["n"] = crypto.ScryptN
		v.KDFParams["r"] = crypto.ScryptR
		v.KDFParams["p"] = crypto.ScryptP
		key, err = crypto.DeriveKeyScrypt(masterPassword, salt, crypto.ScryptN, crypto.ScryptR, crypto.ScryptP)
		if err != nil {
			v.VaultState = "error"
			return err
		}
	} else if keyDerivation == "argon2id" {
		// [L-5] Argon2id is now fully supported in CreateVault
		v.KDFParams["time"] = crypto.Argon2Time
		v.KDFParams["memory"] = crypto.Argon2Memory
		v.KDFParams["parallelism"] = crypto.Argon2Threads
		key = crypto.DeriveKeyArgon2id(masterPassword, salt, uint32(crypto.Argon2Time), uint32(crypto.Argon2Memory), uint8(crypto.Argon2Threads))
	} else {
		// Default: pbkdf2
		if keyDerivation != "pbkdf2" { keyDerivation = "pbkdf2" } // normalize unknown values
		v.KeyDerivation = keyDerivation
		v.KDFParams["iterations"] = crypto.PBKDF2Iterations
		key = crypto.DeriveKeyPBKDF2(masterPassword, salt, crypto.PBKDF2Iterations)
	}

	now := models.GetCurrentTimeISO()
	newVault := &models.Vault{
		Version:    "1.0.0",
		Items:      []models.PasswordItem{},
		Categories: []models.Category{},
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	v.CurrentVault = newVault
	v.VaultState = "unlocked"

	// Initialize Database
	dbConn, err := db.NewDatabase(v.vaultFilePath)
	if err != nil {
		v.VaultState = "error"
		return err
	}
	v.DB = dbConn

	// Derive Index & Encryption Keys
	encSalt, _ := crypto.GenerateRandomBytes(crypto.SaltLength)
	indexSalt, err := crypto.GenerateRandomBytes(crypto.SaltLength)
	if err != nil {
		return err
	}
	encKey, idxKey, err := db.DeriveKeys(key, encSalt, indexSalt)
	if err != nil {
		return err
	}
	v.EncKey = encKey
	v.IdxKey = idxKey

	// Save Metadata
	v.DB.SetMetadata("kdf_algorithm", v.KeyDerivation)
	v.DB.SetMetadata("kdf_salt", base64.StdEncoding.EncodeToString(v.CurrentSalt))
	v.DB.SetMetadata("index_key_salt", base64.StdEncoding.EncodeToString(indexSalt))
	v.DB.SetMetadata("encryption_key_salt", base64.StdEncoding.EncodeToString(encSalt))
	for k, val := range v.KDFParams {
		v.DB.SetMetadata(fmt.Sprintf("kdf_param_%s", k), fmt.Sprintf("%v", val))
	}
	v.DB.SetMetadata("migration_status", "completed")

	// Save Password Verifier
	verifier, _ := v.encryptField("VERIFY")
	v.DB.SetMetadata("password_verifier", base64.StdEncoding.EncodeToString(verifier))

	return nil
}

func (v *VaultManager) UnlockVault(masterPassword string) (*models.Vault, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	return v.unlockInternal(masterPassword)
}

func (v *VaultManager) unlockInternal(masterPassword string) (*models.Vault, error) {
	// 1. Check if SQLite DB already exists
	if _, err := os.Stat(v.vaultFilePath); err == nil {
		return v.unlockSQLite(masterPassword)
	}

	// 2. If no SQLite DB, check if legacy vault.enc exists
	if _, err := os.Stat(v.legacyFilePath); err == nil {
		return v.migrateFromLegacy(masterPassword)
	}

	return nil, errors.New("vault does not exist")
}

func (v *VaultManager) unlockSQLite(masterPassword string) (*models.Vault, error) {
	// Temporarily open DB to get metadata
	tempDB, err := db.NewDatabase(v.vaultFilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	defer tempDB.Close()

	kdf, _ := tempDB.GetMetadata("kdf_algorithm")
	saltB64, _ := tempDB.GetMetadata("kdf_salt")
	idxSaltB64, _ := tempDB.GetMetadata("index_key_salt")
	encSaltB64, _ := tempDB.GetMetadata("encryption_key_salt") // [M-1] May be empty for legacy vaults
	salt, _ := base64.StdEncoding.DecodeString(saltB64)
	idxSalt, _ := base64.StdEncoding.DecodeString(idxSaltB64)
	encSalt, _ := base64.StdEncoding.DecodeString(encSaltB64)

	var key []byte
	switch kdf {
	case "argon2id":
		t, _ := tempDB.GetMetadata("kdf_param_time")
		m, _ := tempDB.GetMetadata("kdf_param_memory")
		p, _ := tempDB.GetMetadata("kdf_param_parallelism")
		tu, _ := strconv.ParseUint(t, 10, 32)
		mu, _ := strconv.ParseUint(m, 10, 32)
		pu, _ := strconv.ParseUint(p, 10, 8)
		key = crypto.DeriveKeyArgon2id(masterPassword, salt, uint32(tu), uint32(mu), uint8(pu))
	case "scrypt":
		n, _ := tempDB.GetMetadata("kdf_param_n")
		r, _ := tempDB.GetMetadata("kdf_param_r")
		p, _ := tempDB.GetMetadata("kdf_param_p")
		ni, _ := strconv.Atoi(n)
		ri, _ := strconv.Atoi(r)
		pi, _ := strconv.Atoi(p)
		key, _ = crypto.DeriveKeyScrypt(masterPassword, salt, ni, ri, pi)
	default:
		it, _ := tempDB.GetMetadata("kdf_param_iterations")
		iterations, _ := strconv.Atoi(it)
		// If 0, DeriveKeyPBKDF2 uses default (600,000)
		key = crypto.DeriveKeyPBKDF2(masterPassword, salt, iterations)
	}

	// Derive keys using both salts
	encKey, idxKey, err := db.DeriveKeys(key, encSalt, idxSalt)
	if err != nil { return nil, err }

	// Verify Password with Self-healing for PBKDF2 iterations
	v.EncKey = encKey // Temporarily set to verify
	verifierB64, _ := tempDB.GetMetadata("password_verifier")
	
	if verifierB64 != "" {
		verifier, _ := base64.StdEncoding.DecodeString(verifierB64)
		_, err = v.decryptField(verifier)
		
		if err != nil {
			// Check 1: Was it encrypted with raw 'key' (Buggy CreateVault)?
			v.EncKey = key
			_, errRaw := v.decryptField(verifier)
			if errRaw == nil {
				// BUGGY VAULT DETECTED!
				// We must do a full re-encryption immediately
				
				// We need `v.DB` for re-encryption, so let's set it temporarily
				v.DB = tempDB
				v.IdxKey = idxKey // IdxKey was correct, only EncKey was wrong
				v.KeyDerivation = kdf
				v.CurrentSalt = salt

				err = v.DB.WithTransaction(context.Background(), func(tx *sql.Tx) error {
					// Fetch all items using OLD keys (v.EncKey == key)
					items, err := v.GetAllPasswordItems()
					if err != nil { return err }
					categories, err := v.GetAllCategories()
					if err != nil { return err }
					
					// Switch to NEW keys for encryption
					v.EncKey = encKey
					defer func() { v.EncKey = key }() // Restore on failure

					now := models.GetCurrentTimeISO()

					// Re-encrypt Categories
					for _, cat := range categories {
						encName, _ := v.encryptField(cat.Name)
						_, err = tx.Exec("UPDATE categories SET name=?, updated_at=? WHERE id=?", encName, now, cat.ID)
						if err != nil { return err }
					}

					// Re-encrypt Items
					for _, item := range items {
						encTitle, _ := v.encryptField(item.Title)
						titleIdx := db.GenerateBlindIndex(item.Title, v.IdxKey)
						encUser, _ := v.encryptField(item.Username)
						encPass, _ := v.encryptField(item.Password)
						encURL, _ := v.encryptField(item.URL)
						encNotes, _ := v.encryptField(item.Notes)
						tagsStr := strings.Join(item.Tags, ",")
						
						_, err = tx.Exec(`UPDATE items SET title=?, title_index=?, username=?, password=?, url=?, notes=?, tags=?, favorite=?, category_id=?, updated_at=? WHERE id=?`,
							encTitle, titleIdx, encUser, encPass, encURL, encNotes, tagsStr, item.Favorite, item.CategoryID, now, item.ID)
						if err != nil { return err }
					}

					// Update password_verifier
					newVerifier, _ := v.encryptField("VERIFY")
					_, err = tx.Exec("UPDATE metadata SET value=?, updated_at=? WHERE key='password_verifier'", base64.StdEncoding.EncodeToString(newVerifier), now)
					if err != nil { return err }

					// Apply new key permanently
					return nil
				})
				
				v.DB = nil // Clear it back so it opens properly below

				if err != nil {
					return nil, fmt.Errorf("failed to repair buggy vault: %w", err)
				}
				
				// Now that it's repaired, let `encKey` be the correct one and proceed
				v.EncKey = encKey
				// Check 2: PBKDF2 Legacy Iterations fallback (legacy has nil encSalt)
				fallbackIters := crypto.PBKDF2LegacyIterations
				fallbackKey := crypto.DeriveKeyPBKDF2(masterPassword, salt, fallbackIters)
				fEncKey, fIdxKey, _ := db.DeriveKeys(fallbackKey, nil, idxSalt)
				
				v.EncKey = fEncKey
				_, errFallback := v.decryptField(verifier)
				if errFallback == nil {
					// Success! Update metadata to fix the DB permanently
					key = fallbackKey
					encKey = fEncKey
					idxKey = fIdxKey
					v.KeyDerivation = "pbkdf2"
				} else {
					return nil, errors.New("invalid master password")
				}
			} else {
				return nil, errors.New("invalid master password")
			}
		}
	}

	// Re-open DB properly
	dbConn, err := db.NewDatabase(v.vaultFilePath)
	if err != nil {
		return nil, err
	}
	v.DB = dbConn
	v.EncKey = encKey
	v.IdxKey = idxKey
	v.CurrentSalt = salt
	v.KeyDerivation = kdf
	v.VaultState = "unlocked"

	// Finalize self-healing or missing verifier
	if verifierB64 == "" {
		// Create verifier if missing (and we reached here successfully)
		verifier, _ := v.encryptField("VERIFY")
		v.DB.SetMetadata("password_verifier", base64.StdEncoding.EncodeToString(verifier))
	}
	
	// If iterations were fixed during self-healing (or if they were missing for PBKDF2)
	if (kdf == "pbkdf2" || kdf == "") {
		it, _ := v.DB.GetMetadata("kdf_param_iterations")
		if it == "" {
			// Save current iterations to DB
			iters := crypto.PBKDF2Iterations // Default
			if len(key) > 0 { // This is slightly tricky, but we know what we used
				// Check if we derived with fallback
				legacyKey := crypto.DeriveKeyPBKDF2(masterPassword, salt, crypto.PBKDF2LegacyIterations)
				if bytes.Equal(key, legacyKey) {
					iters = crypto.PBKDF2LegacyIterations
				}
			}
			v.DB.SetMetadata("kdf_param_iterations", fmt.Sprintf("%d", iters))
		}
	}

	return v.getAllPasswordItemsIntoVaultLocked()
}

func (v *VaultManager) ConfirmMigration() error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.DB == nil { return errors.New("vault is locked") }
	
	v.DB.SetMetadata("migration_status", "completed")
	backupPath := v.legacyFilePath + ".bak"
	if _, err := os.Stat(backupPath); err == nil {
		os.Remove(backupPath)
	}
	return nil
}

func (v *VaultManager) migrateFromLegacy(masterPassword string) (*models.Vault, error) {
	data, err := os.ReadFile(v.legacyFilePath)
	if err != nil {
		return nil, err
	}

	var vaultFile models.VaultFile
	if err := json.Unmarshal(data, &vaultFile); err != nil {
		return nil, err
	}

	salt, _ := base64.StdEncoding.DecodeString(vaultFile.Salt)
	iv, _ := base64.StdEncoding.DecodeString(vaultFile.IV)
	authTag, _ := base64.StdEncoding.DecodeString(vaultFile.AuthTag)
	ciphertext, _ := base64.StdEncoding.DecodeString(vaultFile.Ciphertext)

	kdf := vaultFile.KeyDerivation
	if kdf == "" { kdf = "pbkdf2" }
	
	var masterKey []byte
	if kdf == "scrypt" {
		n, _ := vaultFile.KDFParams["n"].(float64)
		r, _ := vaultFile.KDFParams["r"].(float64)
		p, _ := vaultFile.KDFParams["p"].(float64)
		masterKey, _ = crypto.DeriveKeyScrypt(masterPassword, salt, int(n), int(r), int(p))
	} else {
		iters, _ := vaultFile.KDFParams["iterations"].(float64)
		if iters == 0 { iters = float64(crypto.PBKDF2LegacyIterations) }
		masterKey = crypto.DeriveKeyPBKDF2(masterPassword, salt, int(iters))
	}

	decryptedJson, err := crypto.Decrypt(ciphertext, masterKey, iv, authTag)
	if err != nil {
		return nil, errors.New("invalid master password for legacy vault")
	}

	var legacyVault models.Vault
	json.Unmarshal(decryptedJson, &legacyVault)

	// Migration Process
	v.DB, err = db.NewDatabase(v.vaultFilePath)
	if err != nil {
		return nil, err
	}
	
	encSalt, _ := crypto.GenerateRandomBytes(crypto.SaltLength)
	idxSalt, _ := crypto.GenerateRandomBytes(crypto.SaltLength)
	encKey, idxKey, _ := db.DeriveKeys(masterKey, encSalt, idxSalt)
	
	v.EncKey = encKey
	v.IdxKey = idxKey
	v.CurrentSalt = salt
	v.KeyDerivation = kdf
	v.VaultState = "unlocked"

	v.DB.SetMetadata("kdf_algorithm", kdf)
	v.DB.SetMetadata("kdf_salt", base64.StdEncoding.EncodeToString(salt))
	v.DB.SetMetadata("index_key_salt", base64.StdEncoding.EncodeToString(idxSalt))
	v.DB.SetMetadata("encryption_key_salt", base64.StdEncoding.EncodeToString(encSalt))
	v.DB.SetMetadata("migration_status", "pending_verification")
	
	// Explicitly save iterations for PBKDF2 if missing
	if kdf == "pbkdf2" || kdf == "" {
		iters, _ := vaultFile.KDFParams["iterations"].(float64)
		if iters == 0 { iters = float64(crypto.PBKDF2LegacyIterations) }
		v.DB.SetMetadata("kdf_param_iterations", fmt.Sprintf("%d", int(iters)))
	}

	if vaultFile.KDFParams != nil {
		for k, val := range vaultFile.KDFParams {
			v.DB.SetMetadata(fmt.Sprintf("kdf_param_%s", k), fmt.Sprintf("%v", val))
		}
	}

	// Save Password Verifier
	verifier, _ := v.encryptField("VERIFY")
	v.DB.SetMetadata("password_verifier", base64.StdEncoding.EncodeToString(verifier))

	err = v.DB.WithTransaction(context.Background(), func(tx *sql.Tx) error {
		for _, cat := range legacyVault.Categories {
			encName, _ := v.encryptField(cat.Name)
			_, err := tx.Exec("INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)",
				cat.ID, encName, cat.CreatedAt)
			if err != nil { return err }
		}

		for _, item := range legacyVault.Items {
			encTitle, _ := v.encryptField(item.Title)
			titleIdx := db.GenerateBlindIndex(item.Title, v.IdxKey)
			encUser, _ := v.encryptField(item.Username)
			encPass, _ := v.encryptField(item.Password)
			encURL, _ := v.encryptField(item.URL)
			encNotes, _ := v.encryptField(item.Notes)

			_, err := tx.Exec(`INSERT INTO items (id, category_id, title, title_index, username, password, url, notes, favorite, created_at, updated_at) 
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				item.ID, item.CategoryID, encTitle, titleIdx, encUser, encPass, encURL, encNotes, item.Favorite, item.CreatedAt, item.UpdatedAt)
			if err != nil { return err }
		}
		return nil
	})

	if err != nil {
		v.LockVault()
		os.Remove(v.vaultFilePath)
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	os.Rename(v.legacyFilePath, v.legacyFilePath+".bak")
	return v.getAllPasswordItemsIntoVaultLocked()
}

func (v *VaultManager) GetAllPasswordItemsIntoVault() (*models.Vault, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	return v.getAllPasswordItemsIntoVaultLocked()
}

// Internal version without locking to prevent deadlocks (M-4)
func (v *VaultManager) getAllPasswordItemsIntoVaultLocked() (*models.Vault, error) {
	// [M-4] Use locked internal methods to prevent deadlock if called while holding mu.Lock
	items, err := v.getAllPasswordItemsLocked()
	if err != nil { return nil, err }
	cats, err := v.getAllCategoriesLocked()
	if err != nil { return nil, err }

	v.CurrentVault = &models.Vault{
		Version: "1.0.0",
		Items: items,
		Categories: cats,
	}
	return v.CurrentVault, nil
}

func (v *VaultManager) encryptField(plainText string) ([]byte, error) {
	if plainText == "" { return nil, nil }
	iv, authTag, ciphertext, err := crypto.Encrypt([]byte(plainText), v.EncKey)
	if err != nil { return nil, err }
	// Store in DB as IV + AuthTag + Ciphertext
	result := append(iv, authTag...)
	result = append(result, ciphertext...)
	return result, nil
}

func (v *VaultManager) decryptField(data []byte) (string, error) {
	if len(data) == 0 { return "", nil }
	if len(data) < crypto.IVLength+16 { return "", errors.New("invalid encrypted data length") }
	iv := data[:crypto.IVLength]
	authTag := data[crypto.IVLength : crypto.IVLength+16]
	ciphertext := data[crypto.IVLength+16:]
	
	plain, err := crypto.Decrypt(ciphertext, v.EncKey, iv, authTag)
	if err != nil { return "", err }
	return string(plain), nil
}

func (v *VaultManager) LockVault() error {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.DB != nil {
		v.DB.Close()
		v.DB = nil
	}

	// [L-1] Explicitly clear sensitive keys and data from memory
	v.CurrentVault = nil
	v.EncKey = nil
	v.IdxKey = nil
	v.CurrentSalt = nil
	v.KeyDerivation = ""
	v.KDFParams = nil
	v.VaultState = "locked"

	return nil
}

func (v *VaultManager) ChangeMasterPassword(oldPassword, newPassword string) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	// [M-5] Validate new password length first
	if len(newPassword) < 8 {
		return errors.New("new master password must be at least 8 characters")
	}

	// 1. Verify old password and ensure vault is loaded
	if v.VaultState != "unlocked" {
		_, err := v.unlockInternal(oldPassword)
		if err != nil {
			return errors.New("invalid old password")
		}
	} else {
		// [H-2] Verify old password by re-deriving keys from DB metadata (v.KDFParams may be nil)
		saltB64, _ := v.DB.GetMetadata("kdf_salt")
		kdfSalt, _ := base64.StdEncoding.DecodeString(saltB64)
		kdfAlgo, _ := v.DB.GetMetadata("kdf_algorithm")
		idxSaltB64, _ := v.DB.GetMetadata("index_key_salt")
		idxSalt, _ := base64.StdEncoding.DecodeString(idxSaltB64)
		encSaltB64, _ := v.DB.GetMetadata("encryption_key_salt")
		encSalt, _ := base64.StdEncoding.DecodeString(encSaltB64)

		var oldMasterKey []byte
		switch kdfAlgo {
		case "scrypt":
			n, _ := v.DB.GetMetadata("kdf_param_n")
			r, _ := v.DB.GetMetadata("kdf_param_r")
			p, _ := v.DB.GetMetadata("kdf_param_p")
			ni, _ := strconv.Atoi(n); ri, _ := strconv.Atoi(r); pi, _ := strconv.Atoi(p)
			var sErr error
			oldMasterKey, sErr = crypto.DeriveKeyScrypt(oldPassword, kdfSalt, ni, ri, pi)
			if sErr != nil { return sErr }
		case "argon2id":
			t, _ := v.DB.GetMetadata("kdf_param_time")
			m, _ := v.DB.GetMetadata("kdf_param_memory")
			p, _ := v.DB.GetMetadata("kdf_param_parallelism")
			tu, _ := strconv.ParseUint(t, 10, 32)
			mu, _ := strconv.ParseUint(m, 10, 32)
			pu, _ := strconv.ParseUint(p, 10, 8)
			oldMasterKey = crypto.DeriveKeyArgon2id(oldPassword, kdfSalt, uint32(tu), uint32(mu), uint8(pu))
		default: // pbkdf2
			it, _ := v.DB.GetMetadata("kdf_param_iterations")
			iterations, _ := strconv.Atoi(it)
			if iterations == 0 { iterations = crypto.PBKDF2Iterations }
			oldMasterKey = crypto.DeriveKeyPBKDF2(oldPassword, kdfSalt, iterations)
		}

		oldEncKey, _, derErr := db.DeriveKeys(oldMasterKey, encSalt, idxSalt)
		if derErr != nil || !bytes.Equal(oldEncKey, v.EncKey) {
			return errors.New("invalid old password")
		}
	}

	// 2. Generate new salt and derive new key with UPGRADED parameters
	newSalt, err := crypto.GenerateRandomBytes(crypto.SaltLength)
	if err != nil {
		return err
	}

	// Use current defaults for the new key
	v.KDFParams = make(map[string]interface{})
	var newKey []byte
	if v.KeyDerivation == "scrypt" {
		v.KDFParams["n"] = crypto.ScryptN
		v.KDFParams["r"] = crypto.ScryptR
		v.KDFParams["p"] = crypto.ScryptP
		newKey, err = crypto.DeriveKeyScrypt(newPassword, newSalt, crypto.ScryptN, crypto.ScryptR, crypto.ScryptP)
	} else {
		v.KDFParams["iterations"] = crypto.PBKDF2Iterations
		newKey = crypto.DeriveKeyPBKDF2(newPassword, newSalt, crypto.PBKDF2Iterations)
	}

	if err != nil {
		return err
	}

	newIdxSalt, err := crypto.GenerateRandomBytes(crypto.SaltLength)
	newEncSalt, err := crypto.GenerateRandomBytes(crypto.SaltLength)
	if err != nil { return err }
	newEncKey, newIdxKey, err := db.DeriveKeys(newKey, newEncSalt, newIdxSalt)
	if err != nil { return err }

	// Begin re-encryption
	err = v.DB.WithTransaction(context.Background(), func(tx *sql.Tx) error {
		// Fetch all items using OLD keys
		// [M-4] Use locked internal methods to prevent deadlock as we already hold mu.Lock
		items, err := v.getAllPasswordItemsLocked()
		if err != nil { return err }
		categories, err := v.getAllCategoriesLocked()
		if err != nil { return err }
		
		// Switch to NEW keys for encryption
		oldEncKey, oldIdxKey := v.EncKey, v.IdxKey
		v.EncKey, v.IdxKey = newEncKey, newIdxKey
		defer func() {
			v.EncKey, v.IdxKey = oldEncKey, oldIdxKey
		}()

		now := models.GetCurrentTimeISO()

		// Re-encrypt Categories
		for _, cat := range categories {
			encName, _ := v.encryptField(cat.Name)
			_, err = tx.Exec("UPDATE categories SET name=?, updated_at=? WHERE id=?", encName, now, cat.ID)
			if err != nil { return err }
		}

		// Re-encrypt Items
		for _, item := range items {
			encTitle, _ := v.encryptField(item.Title)
			titleIdx := db.GenerateBlindIndex(item.Title, v.IdxKey)
			encUser, _ := v.encryptField(item.Username)
			encPass, _ := v.encryptField(item.Password)
			encURL, _ := v.encryptField(item.URL)
			encNotes, _ := v.encryptField(item.Notes)
			// [M-3] Encrypt tags during re-encryption
			tagsStr := strings.Join(item.Tags, ",")
			encTags, _ := v.encryptField(tagsStr)
			
			_, err = tx.Exec(`UPDATE items SET title=?, title_index=?, username=?, password=?, url=?, notes=?, tags=?, favorite=?, category_id=?, updated_at=? WHERE id=?`,
				encTitle, titleIdx, encUser, encPass, encURL, encNotes, encTags, item.Favorite, item.CategoryID, now, item.ID)
			if err != nil { return err }
		}

		// Update password_verifier
		verifier, _ := v.encryptField("VERIFY")
		_, err = tx.Exec("INSERT INTO metadata (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at", "password_verifier", base64.StdEncoding.EncodeToString(verifier), now)
		if err != nil { return err }

		// Update metadata using tx
		metadataUpdates := map[string]string{
			"kdf_algorithm": v.KeyDerivation,
			"kdf_salt": base64.StdEncoding.EncodeToString(newSalt),
			"index_key_salt": base64.StdEncoding.EncodeToString(newIdxSalt),
			"encryption_key_salt": base64.StdEncoding.EncodeToString(newEncSalt),
		}
		for k, val := range v.KDFParams {
			metadataUpdates[fmt.Sprintf("kdf_param_%s", k)] = fmt.Sprintf("%v", val)
		}
		for k, val := range metadataUpdates {
			_, err = tx.Exec("INSERT INTO metadata (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at", k, val, now)
			if err != nil { return err }
		}

		// Apply new keys permanently
		oldEncKey, oldIdxKey = newEncKey, newIdxKey
		return nil
	})
	
	if err != nil {
		return err
	}

	// 3. Update manager state and save
	v.EncKey = newEncKey
	v.IdxKey = newIdxKey
	v.CurrentSalt = newSalt
	
	// Ensure temp metadata cache is cleared or reloaded if needed, but we don't cache metadata in DB struct.
	return nil
}

func (v *VaultManager) GetVaultState() string {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.VaultState
}

func (v *VaultManager) VaultExists() bool {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.vaultExistsLocked()
}

func (v *VaultManager) vaultExistsLocked() bool {
	_, err := os.Stat(v.vaultFilePath)
	return !os.IsNotExist(err)
}

func (v *VaultManager) GetVaultFilePath() string {
	return v.vaultFilePath
}
// saveVaultUnlocked is obsolete.

func (v *VaultManager) AddPasswordItem(item models.NewPasswordItem) (*models.PasswordItem, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.VaultState != "unlocked" {
		return nil, errors.New("vault is locked")
	}

	now := models.GetCurrentTimeISO()
	id := uuid.New().String()
	
	// [H-1] Always check encryption errors — never silently store nil/unencrypted data
	encTitle, err := v.encryptField(item.Title)
	if err != nil { return nil, fmt.Errorf("failed to encrypt title: %w", err) }
	titleIdx := db.GenerateBlindIndex(item.Title, v.IdxKey)
	encUser, err := v.encryptField(item.Username)
	if err != nil { return nil, fmt.Errorf("failed to encrypt username: %w", err) }
	encPass, err := v.encryptField(item.Password)
	if err != nil { return nil, fmt.Errorf("failed to encrypt password: %w", err) }
	encURL, err := v.encryptField(item.URL)
	if err != nil { return nil, fmt.Errorf("failed to encrypt url: %w", err) }
	encNotes, err := v.encryptField(item.Notes)
	if err != nil { return nil, fmt.Errorf("failed to encrypt notes: %w", err) }
	// [M-3] Encrypt tags field to prevent metadata leakage
	tagsStr := strings.Join(item.Tags, ",")
	encTags, err := v.encryptField(tagsStr)
	if err != nil { return nil, fmt.Errorf("failed to encrypt tags: %w", err) }

	_, err = v.DB.Conn.Exec(`INSERT INTO items (id, category_id, title, title_index, username, password, url, notes, tags, favorite, created_at, updated_at) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, item.CategoryID, encTitle, titleIdx, encUser, encPass, encURL, encNotes, encTags, item.Favorite, now, now)
	if err != nil {
		return nil, err
	}

	result := &models.PasswordItem{
		ID:         id,
		Title:      item.Title,
		Username:   item.Username,
		Password:   item.Password,
		URL:        item.URL,
		Notes:      item.Notes,
		Tags:       item.Tags,
		Favorite:   item.Favorite,
		CategoryID: item.CategoryID,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	return result, nil
}

func (v *VaultManager) UpdatePasswordItem(id string, updates map[string]interface{}) (*models.PasswordItem, error) {
	v.mu.Lock()
	defer v.mu.Unlock()

	if v.VaultState != "unlocked" {
		return nil, errors.New("vault is locked")
	}

	// Fetch current item to update
	var dbTitle, dbUser, dbPass, dbURL, dbNotes []byte
	var fav bool
	var catID, createdAt, tagsStr, lastUsed string
	err := v.DB.Conn.QueryRow("SELECT title, username, password, url, notes, COALESCE(tags, ''), favorite, category_id, COALESCE(last_used_at, ''), created_at FROM items WHERE id = ?", id).
		Scan(&dbTitle, &dbUser, &dbPass, &dbURL, &dbNotes, &tagsStr, &fav, &catID, &lastUsed, &createdAt)
	if err != nil {
		return nil, errors.New("item not found")
	}

	now := models.GetCurrentTimeISO()
	
	// Prepare SQL dynamically or just Update all fields
	title, _ := v.decryptField(dbTitle)
	username, _ := v.decryptField(dbUser)
	password, _ := v.decryptField(dbPass)
	url, _ := v.decryptField(dbURL)
	notes, _ := v.decryptField(dbNotes)
	tags := strings.Split(tagsStr, ",")
	if tagsStr == "" { tags = []string{} }

	if val, ok := updates["title"].(string); ok { title = val }
	if val, ok := updates["username"].(string); ok { username = val }
	if val, ok := updates["password"].(string); ok { password = val }
	if val, ok := updates["url"].(string); ok { url = val }
	if val, ok := updates["notes"].(string); ok { notes = val }
	if val, ok := updates["tags"].([]interface{}); ok {
		tags = make([]string, len(val))
		for i, t := range val { tags[i], _ = t.(string) }
	}
	if val, ok := updates["favorite"].(bool); ok { fav = val }
	if val, ok := updates["categoryId"].(string); ok { catID = val }

	// [H-1] Always check encryption errors
	encTitle, err2 := v.encryptField(title)
	if err2 != nil { return nil, fmt.Errorf("failed to encrypt title: %w", err2) }
	titleIdx := db.GenerateBlindIndex(title, v.IdxKey)
	encUser, err2 := v.encryptField(username)
	if err2 != nil { return nil, fmt.Errorf("failed to encrypt username: %w", err2) }
	encPass, err2 := v.encryptField(password)
	if err2 != nil { return nil, fmt.Errorf("failed to encrypt password: %w", err2) }
	encURL, err2 := v.encryptField(url)
	if err2 != nil { return nil, fmt.Errorf("failed to encrypt url: %w", err2) }
	encNotes, err2 := v.encryptField(notes)
	if err2 != nil { return nil, fmt.Errorf("failed to encrypt notes: %w", err2) }
	// [M-3] Encrypt tags
	newTagsStr := strings.Join(tags, ",")
	encTags, err2 := v.encryptField(newTagsStr)
	if err2 != nil { return nil, fmt.Errorf("failed to encrypt tags: %w", err2) }

	_, err = v.DB.Conn.Exec(`UPDATE items SET title=?, title_index=?, username=?, password=?, url=?, notes=?, tags=?, favorite=?, category_id=?, updated_at=? WHERE id=?`,
		encTitle, titleIdx, encUser, encPass, encURL, encNotes, encTags, fav, catID, now, id)
	if err != nil {
		return nil, err
	}

	return &models.PasswordItem{
		ID: id, Title: title, Username: username, Password: password, URL: url, Notes: notes, Tags: tags, Favorite: fav, CategoryID: catID, LastUsedAt: lastUsed, CreatedAt: createdAt, UpdatedAt: now,
	}, nil
}

func (v *VaultManager) DeletePasswordItem(id string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.VaultState != "unlocked" { return errors.New("vault is locked") }
	_, err := v.DB.Conn.Exec("DELETE FROM items WHERE id = ?", id)
	return err
}

func (v *VaultManager) GetPasswordItem(id string) (*models.PasswordItem, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	if v.VaultState != "unlocked" { return nil, errors.New("vault is locked") }

	var item models.PasswordItem
	var encTitle, encUser, encPass, encURL, encNotes, encTags []byte
	err := v.DB.Conn.QueryRow(`SELECT id, category_id, title, username, password, url, notes, COALESCE(tags, ''), favorite, COALESCE(last_used_at, ''), created_at, updated_at 
		FROM items WHERE id = ?`, id).Scan(
		&item.ID, &item.CategoryID, &encTitle, &encUser, &encPass, &encURL, &encNotes, &encTags, &item.Favorite, &item.LastUsedAt, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows { return nil, nil }
		return nil, err
	}

	item.Title, _ = v.decryptField(encTitle)
	item.Username, _ = v.decryptField(encUser)
	item.Password, _ = v.decryptField(encPass)
	item.URL, _ = v.decryptField(encURL)
	item.Notes, _ = v.decryptField(encNotes)
	// [M-3] Decrypt tags; fall back to empty if decryption fails (legacy plain-text data)
	if tagsPlain, tErr := v.decryptField(encTags); tErr == nil && tagsPlain != "" {
		item.Tags = strings.Split(tagsPlain, ",")
	} else {
		item.Tags = []string{}
	}

	return &item, nil
}

func (v *VaultManager) GetAllPasswordItems() ([]models.PasswordItem, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.getAllPasswordItemsLocked()
}

// Internal version without locking to prevent deadlocks (M-4)
func (v *VaultManager) getAllPasswordItemsLocked() ([]models.PasswordItem, error) {
	if v.VaultState != "unlocked" { return nil, errors.New("vault is locked") }
	rows, err := v.DB.Conn.Query("SELECT id, category_id, title, username, password, url, notes, COALESCE(tags, ''), favorite, COALESCE(last_used_at, ''), created_at, updated_at FROM items")
	if err != nil { return nil, err }
	defer rows.Close()

	var items []models.PasswordItem
	for rows.Next() {
		var item models.PasswordItem
		var encTitle, encUser, encPass, encURL, encNotes, encTags []byte
		err := rows.Scan(&item.ID, &item.CategoryID, &encTitle, &encUser, &encPass, &encURL, &encNotes, &encTags, &item.Favorite, &item.LastUsedAt, &item.CreatedAt, &item.UpdatedAt)
		if err != nil { return nil, err }
		
		item.Title, _ = v.decryptField(encTitle)
		item.Username, _ = v.decryptField(encUser)
		item.Password, _ = v.decryptField(encPass)
		item.URL, _ = v.decryptField(encURL)
		item.Notes, _ = v.decryptField(encNotes)
		// [M-3] Decrypt tags; fall back to empty if decryption fails (legacy plain-text data)
		if tagsPlain, tErr := v.decryptField(encTags); tErr == nil && tagsPlain != "" {
			item.Tags = strings.Split(tagsPlain, ",")
		} else {
			item.Tags = []string{}
		}
		items = append(items, item)
	}
	return items, nil
}

func (v *VaultManager) TrackUsage(id string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.DB == nil { return errors.New("vault is locked") }
	now := models.GetCurrentTimeISO()
	_, err := v.DB.Conn.Exec("UPDATE items SET last_used_at = ? WHERE id = ?", now, id)
	return err
}

func (v *VaultManager) AddCategory(name string) (*models.Category, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.VaultState != "unlocked" { return nil, errors.New("vault is locked") }

	// [L-4] Validate category name length
	const MaxCategoryNameLength = 100
	if len(strings.TrimSpace(name)) == 0 { return nil, errors.New("category name cannot be empty") }
	if len(name) > MaxCategoryNameLength { return nil, fmt.Errorf("category name must not exceed %d characters", MaxCategoryNameLength) }

	// Duplicate check using internal locked method to avoid deadlock
	cats, _ := v.getAllCategoriesLocked()
	for _, c := range cats {
		if strings.EqualFold(c.Name, name) { return nil, errors.New("category already exists") }
	}

	id := uuid.New().String()
	now := models.GetCurrentTimeISO()
	encName, err := v.encryptField(name)
	if err != nil { return nil, fmt.Errorf("failed to encrypt category name: %w", err) }

	var maxSortOrder int
	err = v.DB.Conn.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM categories").Scan(&maxSortOrder)
	if err != nil { maxSortOrder = 0 }
	sortOrder := maxSortOrder + 1

	_, err = v.DB.Conn.Exec("INSERT INTO categories (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", id, encName, sortOrder, now, now)
	if err != nil { return nil, err }

	return &models.Category{ID: id, Name: name, SortOrder: sortOrder, CreatedAt: now, UpdatedAt: now}, nil
}

func (v *VaultManager) GetAllCategories() ([]models.Category, error) {
	v.mu.RLock()
	defer v.mu.RUnlock()
	return v.getAllCategoriesLocked()
}

// Internal version without locking to prevent deadlocks (M-4)
func (v *VaultManager) getAllCategoriesLocked() ([]models.Category, error) {
	if v.DB == nil { return nil, errors.New("vault is locked") }
	rows, err := v.DB.Conn.Query("SELECT id, name, sort_order, created_at, updated_at FROM categories ORDER BY sort_order ASC, name ASC")
	if err != nil { return nil, err }
	defer rows.Close()

	var cats []models.Category
	for rows.Next() {
		var cat models.Category
		var encName []byte
		if err := rows.Scan(&cat.ID, &encName, &cat.SortOrder, &cat.CreatedAt, &cat.UpdatedAt); err != nil { return nil, err }
		cat.Name, _ = v.decryptField(encName)
		cats = append(cats, cat)
	}
	return cats, nil
}

func (v *VaultManager) DeleteCategory(id string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.VaultState != "unlocked" { return errors.New("vault is locked") }

	// FK check
	var count int
	v.DB.Conn.QueryRow("SELECT COUNT(*) FROM items WHERE category_id = ?", id).Scan(&count)
	if count > 0 { return errors.New("category is in use") }

	_, err := v.DB.Conn.Exec("DELETE FROM categories WHERE id = ?", id)
	return err
}

func (v *VaultManager) UpdateCategory(id string, name string) (*models.Category, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.VaultState != "unlocked" { return nil, errors.New("vault is locked") }

	// [M-4] Duplicate check using internal locked helper to avoid deadlock
	cats, _ := v.getAllCategoriesLocked()
	for _, c := range cats {
		if c.ID != id && strings.EqualFold(c.Name, name) { 
			return nil, errors.New("category with this name already exists") 
		}
	}

	encName, _ := v.encryptField(name)
	now := models.GetCurrentTimeISO()
	_, err := v.DB.Conn.Exec("UPDATE categories SET name=?, updated_at=? WHERE id=?", encName, now, id)
	if err != nil { return nil, err }

	var createdAt string
	var sortOrder int
	v.DB.Conn.QueryRow("SELECT sort_order, created_at FROM categories WHERE id=?", id).Scan(&sortOrder, &createdAt)

	return &models.Category{ID: id, Name: name, SortOrder: sortOrder, CreatedAt: createdAt, UpdatedAt: now}, nil
}

func (v *VaultManager) ReorderCategories(categoryIds []string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.VaultState != "unlocked" { return errors.New("vault is locked") }

	return v.DB.WithTransaction(context.Background(), func(tx *sql.Tx) error {
		stmt, err := tx.Prepare("UPDATE categories SET sort_order = ? WHERE id = ?")
		if err != nil { return err }
		defer stmt.Close()

		for i, id := range categoryIds {
			_, err = stmt.Exec(i, id)
			if err != nil { return err }
		}
		return nil
	})
}

func (v *VaultManager) VerifyBackup(data []byte, password string) error {
	// Try parsing as JSON first (Legacy .enc)
	var vaultFile models.VaultFile
	if err := json.Unmarshal(data, &vaultFile); err == nil && vaultFile.Ciphertext != "" {
		return v.verifyLegacyBackup(vaultFile, password)
	}

	// If not JSON, assume SQLite (.db)
	return v.verifySQLiteBackup(data, password)
}

func (v *VaultManager) verifyLegacyBackup(vaultFile models.VaultFile, password string) error {
	salt, _ := base64.StdEncoding.DecodeString(vaultFile.Salt)
	iv, _ := base64.StdEncoding.DecodeString(vaultFile.IV)
	authTag, _ := base64.StdEncoding.DecodeString(vaultFile.AuthTag)
	ciphertext, _ := base64.StdEncoding.DecodeString(vaultFile.Ciphertext)

	kdf := vaultFile.KeyDerivation
	if kdf == "" { kdf = "pbkdf2" }

	var key []byte
	if kdf == "scrypt" {
		n, _ := vaultFile.KDFParams["n"].(float64)
		r, _ := vaultFile.KDFParams["r"].(float64)
		p, _ := vaultFile.KDFParams["p"].(float64)
		key, _ = crypto.DeriveKeyScrypt(password, salt, int(n), int(r), int(p))
	} else {
		iters, _ := vaultFile.KDFParams["iterations"].(float64)
		if iters == 0 { iters = float64(crypto.PBKDF2LegacyIterations) }
		key = crypto.DeriveKeyPBKDF2(password, salt, int(iters))
	}

	_, err := crypto.Decrypt(ciphertext, key, iv, authTag)
	if err != nil {
		return errors.New("invalid backup password")
	}
	return nil
}

func (v *VaultManager) verifySQLiteBackup(data []byte, password string) error {
	// Write to temp file to open as SQLite
	tempPath := filepath.Join(os.TempDir(), fmt.Sprintf("verify_%d.db", time.Now().UnixNano()))
	if err := os.WriteFile(tempPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write temp file: %w", err)
	}
	defer os.Remove(tempPath)

	tempDB, err := db.NewDatabase(tempPath)
	if err != nil {
		return errors.New("invalid backup file format")
	}
	defer tempDB.Close()

	// Check metadata
	kdf, _ := tempDB.GetMetadata("kdf_algorithm")
	saltB64, _ := tempDB.GetMetadata("kdf_salt")
	if kdf == "" || saltB64 == "" {
		return errors.New("invalid backup: missing security metadata")
	}

	salt, _ := base64.StdEncoding.DecodeString(saltB64)
	
	// Test KDF by trying to read another piece of metadata or just assuming correct if metadata readable
	// Actually, the metadata isn't encrypted, so we can't "verify" the password just by reading it.
	// We need to try to decrypt ONE record.
	
	var encTitle []byte
	err = tempDB.Conn.QueryRow("SELECT title FROM items LIMIT 1").Scan(&encTitle)
	if err != nil {
		if err == sql.ErrNoRows {
			// [H-3] No items: fall back to password_verifier in metadata
			verifierB64, _ := tempDB.GetMetadata("password_verifier")
			if verifierB64 == "" {
				return errors.New("cannot verify backup: no items and no password_verifier metadata")
			}
			// Derive key + encKey to try decrypting the verifier
			verifierData, vErr := base64.StdEncoding.DecodeString(verifierB64)
			if vErr != nil || len(verifierData) < crypto.IVLength+16 {
				return errors.New("invalid backup: corrupted password_verifier")
			}
			var vKey []byte
			switch kdf {
			case "argon2id":
				t, _ := tempDB.GetMetadata("kdf_param_time")
				m, _ := tempDB.GetMetadata("kdf_param_memory")
				p, _ := tempDB.GetMetadata("kdf_param_parallelism")
				tu, _ := strconv.ParseUint(t, 10, 32)
				mu, _ := strconv.ParseUint(m, 10, 32)
				pu, _ := strconv.ParseUint(p, 10, 8)
				vKey = crypto.DeriveKeyArgon2id(password, salt, uint32(tu), uint32(mu), uint8(pu))
			case "scrypt":
				n, _ := tempDB.GetMetadata("kdf_param_n")
				r, _ := tempDB.GetMetadata("kdf_param_r")
				p, _ := tempDB.GetMetadata("kdf_param_p")
				ni, _ := strconv.Atoi(n); ri, _ := strconv.Atoi(r); pi, _ := strconv.Atoi(p)
				vKey, _ = crypto.DeriveKeyScrypt(password, salt, ni, ri, pi)
			default:
				it, _ := tempDB.GetMetadata("kdf_param_iterations")
				iterations, _ := strconv.Atoi(it)
				vKey = crypto.DeriveKeyPBKDF2(password, salt, iterations)
			}
			encSaltB64, _ := tempDB.GetMetadata("encryption_key_salt")
			idxSaltB64, _ := tempDB.GetMetadata("index_key_salt")
			encSalt, _ := base64.StdEncoding.DecodeString(encSaltB64)
			idxSalt, _ := base64.StdEncoding.DecodeString(idxSaltB64)
			vEncKey, _, _ := db.DeriveKeys(vKey, encSalt, idxSalt)
			vIV := verifierData[:crypto.IVLength]
			vAuthTag := verifierData[crypto.IVLength : crypto.IVLength+16]
			vCipher := verifierData[crypto.IVLength+16:]
			if _, vDecErr := crypto.Decrypt(vCipher, vEncKey, vIV, vAuthTag); vDecErr != nil {
				return errors.New("invalid backup password")
			}
			return nil
		}
		return fmt.Errorf("failed to read items from backup: %w", err)
	}

	// Derive key
	var key []byte
	switch kdf {
	case "argon2id":
		t, _ := tempDB.GetMetadata("kdf_param_time")
		m, _ := tempDB.GetMetadata("kdf_param_memory")
		p, _ := tempDB.GetMetadata("kdf_param_parallelism")
		tu, _ := strconv.ParseUint(t, 10, 32)
		mu, _ := strconv.ParseUint(m, 10, 32)
		pu, _ := strconv.ParseUint(p, 10, 8)
		key = crypto.DeriveKeyArgon2id(password, salt, uint32(tu), uint32(mu), uint8(pu))
	case "scrypt":
		n, _ := tempDB.GetMetadata("kdf_param_n")
		r, _ := tempDB.GetMetadata("kdf_param_r")
		p, _ := tempDB.GetMetadata("kdf_param_p")
		ni, _ := strconv.Atoi(n)
		ri, _ := strconv.Atoi(r)
		pi, _ := strconv.Atoi(p)
		key, _ = crypto.DeriveKeyScrypt(password, salt, ni, ri, pi)
	default:
		it, _ := tempDB.GetMetadata("kdf_param_iterations")
		iterations, _ := strconv.Atoi(it)
		key = crypto.DeriveKeyPBKDF2(password, salt, iterations)
	}

	// Derive Encryption Key
	encSaltB64, _ := tempDB.GetMetadata("encryption_key_salt")
	idxSaltB64, _ := tempDB.GetMetadata("index_key_salt")
	encSalt, _ := base64.StdEncoding.DecodeString(encSaltB64)
	idxSalt, _ := base64.StdEncoding.DecodeString(idxSaltB64)
	verifyEncKey, _, _ := db.DeriveKeys(key, encSalt, idxSalt)

	// Try decrypting the sample title
	if len(encTitle) < crypto.IVLength+16 { return errors.New("invalid encrypted title in backup") }
	iv := encTitle[:crypto.IVLength]
	authTag := encTitle[crypto.IVLength : crypto.IVLength+16]
	ciphertext := encTitle[crypto.IVLength+16:]
	
	_, err = crypto.Decrypt(ciphertext, verifyEncKey, iv, authTag)
	if err != nil {
		return errors.New("invalid backup password")
	}

	return nil
}

func (v *VaultManager) Backup(destPath string) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.DB == nil { return errors.New("vault is locked") }
	return v.DB.Backup(destPath)
}
