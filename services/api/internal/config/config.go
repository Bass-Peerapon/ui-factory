// Package config loads settings from the environment and the repo-level .env file.
package config

import (
	"bufio"
	"cmp"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	Port            int
	DatabasePath    string
	ComposerURL     string
	ComposerMode    string
	GeminiAPIKey    string
	GeminiModel     string
	GeminiFastModel string
	MaxRetries      int
	GeminiRPM       int
	GeminiFastRPM   int
	ImageModel      string
	ImageRPM        int
	ImagesDir       string
	FixturesDir     string
}

// Load reads .env (without overriding variables already set) and returns the config.
func Load() Config {
	root := findRepoRoot()
	if root != "" {
		loadDotEnv(filepath.Join(root, ".env"))
	}
	db := cmp.Or(os.Getenv("DATABASE_PATH"), "./data/ui-factory.db")
	if !filepath.IsAbs(db) && root != "" {
		db = filepath.Join(root, db)
	}
	return Config{
		Port:            atoi(os.Getenv("API_PORT"), 8080),
		DatabasePath:    db,
		ComposerURL:     cmp.Or(os.Getenv("COMPOSER_URL"), "http://localhost:8081"),
		ComposerMode:    cmp.Or(os.Getenv("COMPOSER_MODE"), "jev"),
		GeminiAPIKey:    os.Getenv("GEMINI_API_KEY"),
		GeminiModel:     cmp.Or(os.Getenv("GEMINI_MODEL"), "gemini-flash-latest"),
		GeminiFastModel: cmp.Or(os.Getenv("GEMINI_FAST_MODEL"), "gemini-flash-lite-latest"),
		MaxRetries:      atoi(os.Getenv("AGENT_MAX_RETRIES"), 3),
		GeminiRPM:       atoi(os.Getenv("GEMINI_RPM"), 5),
		GeminiFastRPM:   atoi(os.Getenv("GEMINI_FAST_RPM"), 15),
		ImageModel:      envOr("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image"),
		ImageRPM:        atoi(os.Getenv("GEMINI_IMAGE_RPM"), 10),
		ImagesDir:       filepath.Join(filepath.Dir(db), "images"),
		FixturesDir:     filepath.Join(root, "packages/catalog/fixtures"),
	}
}

// envOr returns the variable when it is set, even to "" (which disables a feature), else def.
func envOr(key, def string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return def
}

func atoi(s string, def int) int {
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	return def
}

// findRepoRoot walks up from the working directory to the folder holding pnpm-workspace.yaml.
func findRepoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "pnpm-workspace.yaml")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return ""
		}
		dir = parent
	}
}

func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		if _, set := os.LookupEnv(k); !set {
			os.Setenv(strings.TrimSpace(k), strings.Trim(strings.TrimSpace(v), `"'`))
		}
	}
}
