package crypto

import (
	"bytes"
	"testing"
)

func TestGenerateRandomBytes(t *testing.T) {
	bytes1, err := GenerateRandomBytes(32)
	if err != nil {
		t.Fatalf("Failed to generate bytes: %v", err)
	}
	if len(bytes1) != 32 {
		t.Fatalf("Expected length 32, got %d", len(bytes1))
	}

	bytes2, _ := GenerateRandomBytes(32)
	if bytes.Equal(bytes1, bytes2) {
		t.Fatalf("Random bytes should not be equal")
	}
}

func TestDeriveKeyPBKDF2(t *testing.T) {
	password := "my_secure_password"
	salt, _ := GenerateRandomBytes(32)

	key1 := DeriveKeyPBKDF2(password, salt, 0)
	if len(key1) != 32 {
		t.Fatalf("Expected key length 32, got %d", len(key1))
	}

	key2 := DeriveKeyPBKDF2(password, salt, 0)
	if !bytes.Equal(key1, key2) {
		t.Fatalf("DeriveKeyPBKDF2 should be deterministic for the same inputs")
	}
}

func TestDeriveKeyScrypt(t *testing.T) {
	password := "my_secure_password"
	salt, _ := GenerateRandomBytes(32)

	key1, err := DeriveKeyScrypt(password, salt, 0, 0, 0)
	if err != nil {
		t.Fatalf("Failed to derive scrypt key: %v", err)
	}
	
	if len(key1) != 32 {
		t.Fatalf("Expected key length 32, got %d", len(key1))
	}

	key2, _ := DeriveKeyScrypt(password, salt, 0, 0, 0)
	if !bytes.Equal(key1, key2) {
		t.Fatalf("DeriveKeyScrypt should be deterministic for the same inputs")
	}

	key3, _ := DeriveKeyScrypt("different_password", salt, 0, 0, 0)
	if bytes.Equal(key1, key3) {
		t.Fatalf("Different passwords should generate different keys")
	}
}

func TestEncryptDecrypt(t *testing.T) {
	plaintext := []byte("This is a highly secret vault payload!")
	key, _ := GenerateRandomBytes(32)

	// Encrypt
	iv, authTag, ciphertext, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("Encryption failed: %v", err)
	}

	if len(iv) != 12 {
		t.Fatalf("Expected IV length 12, got %d", len(iv))
	}

	if len(authTag) != 16 {
		t.Fatalf("Expected auth tag length 16, got %d", len(authTag))
	}

	// Decrypt
	decrypted, err := Decrypt(ciphertext, key, iv, authTag)
	if err != nil {
		t.Fatalf("Decryption failed: %v", err)
	}

	if !bytes.Equal(plaintext, decrypted) {
		t.Fatalf("Decrypted text does not match original plaintext")
	}
}

func TestDecryptFailureWithWrongKey(t *testing.T) {
	plaintext := []byte("Secret payload")
	key, _ := GenerateRandomBytes(32)
	wrongKey, _ := GenerateRandomBytes(32)

	iv, authTag, ciphertext, _ := Encrypt(plaintext, key)

	_, err := Decrypt(ciphertext, wrongKey, iv, authTag)
	if err == nil {
		t.Fatalf("Expected decryption to fail with wrong key")
	}
}
