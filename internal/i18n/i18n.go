package i18n

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var locales = make(map[string]map[string]string)

// LoadLocales loads translation files from the specified directory
func LoadLocales(localesDir string) error {
	files, err := os.ReadDir(localesDir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".json") {
			lang := strings.TrimSuffix(file.Name(), ".json")
			filePath := filepath.Join(localesDir, file.Name())
			
			data, err := os.ReadFile(filePath)
			if err != nil {
				continue
			}

			var m map[string]string
			if err := json.Unmarshal(data, &m); err != nil {
				continue
			}
			locales[lang] = m
		}
	}
	return nil
}

// T returns the translated string for a given language and key
func T(lang, key string, args ...interface{}) string {
	m, ok := locales[lang]
	if !ok {
		// Fallback to English if language not found
		m, ok = locales["en"]
		if !ok {
			return key
		}
	}

	val, ok := m[key]
	if !ok {
		return key
	}

	if len(args) > 0 {
		return fmt.Sprintf(val, args...)
	}
	return val
}
