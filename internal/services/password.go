package services

import (
	"crypto/rand"
	"errors"
	"math"
	"math/big"
	"regexp"
	"time"
)

type PasswordOptions struct {
	Length           int  `json:"length"`
	IncludeUppercase bool `json:"includeUppercase"`
	IncludeLowercase bool `json:"includeLowercase"`
	IncludeNumbers   bool `json:"includeNumbers"`
	IncludeSymbols   bool `json:"includeSymbols"`
}

type PasswordGenerationResult struct {
	Password    string          `json:"password"`
	Strength    int             `json:"strength"`
	Entropy     float64         `json:"entropy"`
	GeneratedAt string          `json:"generatedAt"`
	Options     PasswordOptions `json:"options"`
}

const (
	Uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	Lowercase = "abcdefghijklmnopqrstuvwxyz"
	Numbers   = "0123456789"
	Symbols   = "!@#$%^&*()_+-=[]{}|;:,.<>?"
)

func GeneratePassword(opts PasswordOptions) (*PasswordGenerationResult, error) {
	if opts.Length < 8 || opts.Length > 128 {
		return nil, errors.New("password length must be between 8 and 128")
	}

	var charset string
	var requiredCharsets []string

	if opts.IncludeUppercase {
		charset += Uppercase
		requiredCharsets = append(requiredCharsets, Uppercase)
	}
	if opts.IncludeLowercase {
		charset += Lowercase
		requiredCharsets = append(requiredCharsets, Lowercase)
	}
	if opts.IncludeNumbers {
		charset += Numbers
		requiredCharsets = append(requiredCharsets, Numbers)
	}
	if opts.IncludeSymbols {
		charset += Symbols
		requiredCharsets = append(requiredCharsets, Symbols)
	}

	if len(charset) == 0 {
		return nil, errors.New("at least one character set must be selected")
	}

	if opts.Length < len(requiredCharsets) {
		return nil, errors.New("password length cannot be smaller than the number of selected character sets")
	}

	passwordChars := make([]byte, 0, opts.Length)

	// Step 1: ensure at least one character from each selected charset occurs
	for _, reqCharset := range requiredCharsets {
		idx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(reqCharset))))
		passwordChars = append(passwordChars, reqCharset[idx.Int64()])
	}

	// Step 2: fill the rest
	remaining := opts.Length - len(requiredCharsets)
	for i := 0; i < remaining; i++ {
		idx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		passwordChars = append(passwordChars, charset[idx.Int64()])
	}

	// Step 3: shuffle the result
	for i := len(passwordChars) - 1; i > 0; i-- {
		j, _ := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		passwordChars[i], passwordChars[j.Int64()] = passwordChars[j.Int64()], passwordChars[i]
	}

	password := string(passwordChars)
	strength := evaluateStrength(password)
	entropy := calculateEntropy(password)

	return &PasswordGenerationResult{
		Password:    password,
		Strength:    strength,
		Entropy:     entropy,
		GeneratedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		Options:     opts,
	}, nil
}

func evaluateStrength(password string) int {
	score := 0.0
	length := len(password)

	// Length score
	score += math.Min(float64(length)*2, 40)

	// Diversity score
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	hasNumber := regexp.MustCompile(`\d`).MatchString(password)
	hasSymbol := regexp.MustCompile(`[^A-Za-z0-9]`).MatchString(password)

	if hasUpper {
		score += 7.5
	}
	if hasLower {
		score += 7.5
	}
	if hasNumber {
		score += 7.5
	}
	if hasSymbol {
		score += 7.5
	}

	// Entropy score
	entropy := calculateEntropy(password)
	score += math.Min(entropy/4, 30)

	// Deductions
	hasRepeats := regexp.MustCompile(`(.)\1{2,}`).MatchString(password)
	if hasRepeats {
		score -= 10
	}

	res := int(math.Round(score))
	if res < 0 {
		return 0
	} else if res > 100 {
		return 100
	}
	return res
}

func calculateEntropy(password string) float64 {
	charsetSize := 0
	if regexp.MustCompile(`[a-z]`).MatchString(password) {
		charsetSize += 26
	}
	if regexp.MustCompile(`[A-Z]`).MatchString(password) {
		charsetSize += 26
	}
	if regexp.MustCompile(`\d`).MatchString(password) {
		charsetSize += 10
	}
	if regexp.MustCompile(`[^A-Za-z0-9]`).MatchString(password) {
		charsetSize += 32
	}

	if charsetSize == 0 {
		return 0
	}

	return math.Log2(math.Pow(float64(charsetSize), float64(len(password))))
}

func CheckStrength(password string) int {
	return evaluateStrength(password)
}
