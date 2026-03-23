package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"

	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/pbkdf2"
	"golang.org/x/crypto/scrypt"
)

const (
	PBKDF2Iterations      = 600000 // OWASP-recommended for HMAC-SHA256 (2023)
	PBKDF2LegacyIterations = 100000 // Backward compatibility
	KeyLength             = 32     // 256 bits
	SaltLength            = 32
	IVLength              = 12

	// Scrypt defaults
	ScryptN = 65536 // Memory cost
	ScryptR = 8     // Block size
	ScryptP = 1     // Parallelization

	// Argon2id defaults (Wait, let's use reasonably strong defaults)
	Argon2Time    = 3
	Argon2Memory  = 64 * 1024 // 64 MB
	Argon2Threads = 4
)

// GenerateRandomBytes generates a sequence of random bytes
func GenerateRandomBytes(length int) ([]byte, error) {
	b := make([]byte, length)
	_, err := rand.Read(b)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// DeriveKeyPBKDF2 derives a 32-byte key from password and salt using PBKDF2-HMAC-SHA256
func DeriveKeyPBKDF2(password string, salt []byte, iterations int) []byte {
	if iterations <= 0 {
		iterations = PBKDF2Iterations
	}
	return pbkdf2.Key([]byte(password), salt, iterations, KeyLength, sha256.New)
}

// DeriveKeyScrypt derives a 32-byte key from password and salt using Scrypt
func DeriveKeyScrypt(password string, salt []byte, N, r, p int) ([]byte, error) {
	if N <= 0 {
		N = ScryptN
	}
	if r <= 0 {
		r = ScryptR
	}
	if p <= 0 {
		p = ScryptP
	}
	return scrypt.Key([]byte(password), salt, N, r, p, KeyLength)
}

// DeriveKeyArgon2id derives a 32-byte key using Argon2id
func DeriveKeyArgon2id(password string, salt []byte, time, memory uint32, threads uint8) []byte {
	if time == 0 {
		time = Argon2Time
	}
	if memory == 0 {
		memory = Argon2Memory
	}
	if threads == 0 {
		threads = uint8(Argon2Threads)
	}
	return argon2.IDKey([]byte(password), salt, time, memory, threads, uint32(KeyLength))
}

// Encrypt payload using AES-256-GCM.
// Returns the IV, and the ciphertext (which includes the auth tag at the end in Go's standard library).
func Encrypt(plaintext []byte, key []byte) (iv []byte, authTag []byte, ciphertext []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, nil, err
	}

	iv, err = GenerateRandomBytes(IVLength)
	if err != nil {
		return nil, nil, nil, err
	}

	// Seal appends the ciphertext and the authentication tag.
	sealed := gcm.Seal(nil, iv, plaintext, nil)
	
	// sealed = ciphertext + authTag (authTag is the last 16 bytes)
	tagSize := gcm.Overhead()
	cLength := len(sealed) - tagSize
	
	ciphertext = sealed[:cLength]
	authTag = sealed[cLength:]

	return iv, authTag, ciphertext, nil
}

// Decrypt ciphertext using AES-256-GCM
// Need to append authTag to the ciphertext because Go expects them together
func Decrypt(ciphertext []byte, key []byte, iv []byte, authTag []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	// Go's GCM expects ciphertext + authTag
	fullCipher := append(ciphertext, authTag...)

	plaintext, err := gcm.Open(nil, iv, fullCipher, nil)
	if err != nil {
		return nil, errors.New("decryption failed or authentication tag mismatch")
	}

	return plaintext, nil
}
