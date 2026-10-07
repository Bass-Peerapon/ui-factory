// Package images stores generated page photos on disk and serves them to the frame renderer.
// Specs keep only the URL, so snapshots in SQLite stay small.
package images

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
)

// URLPrefix is the path specs store; the frame resolves it against the API origin.
const URLPrefix = "/api/images/"

var extOf = map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

var validName = regexp.MustCompile(`^[0-9a-f]{24}\.(jpg|png|webp)$`)

type Store struct{ Dir string }

// Save writes the image under a content-addressed name and returns its URL path.
func (s *Store) Save(data []byte, mime string) (string, error) {
	ext, ok := extOf[mime]
	if !ok {
		return "", fmt.Errorf("unsupported image type %q", mime)
	}
	sum := sha256.Sum256(data)
	name := hex.EncodeToString(sum[:12]) + ext
	if err := os.MkdirAll(s.Dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(s.Dir, name)
	if _, err := os.Stat(path); err != nil {
		tmp := path + ".tmp"
		if err := os.WriteFile(tmp, data, 0o644); err != nil {
			return "", err
		}
		if err := os.Rename(tmp, path); err != nil {
			return "", err
		}
	}
	return URLPrefix + name, nil
}

// Serve handles GET /api/images/{name}. Names are content hashes, so responses never change.
func (s *Store) Serve(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if !validName.MatchString(name) {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, filepath.Join(s.Dir, name))
}
