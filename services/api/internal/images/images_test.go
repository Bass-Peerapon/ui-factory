package images

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSaveAndServe(t *testing.T) {
	s := &Store{Dir: t.TempDir()}
	url, err := s.Save([]byte("jpeg-bytes"), "image/jpeg")
	if err != nil {
		t.Fatal(err)
	}
	again, _ := s.Save([]byte("jpeg-bytes"), "image/jpeg")
	if url != again || !strings.HasPrefix(url, URLPrefix) || !strings.HasSuffix(url, ".jpg") {
		t.Fatalf("url %q, again %q", url, again)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/images/{name}", s.Serve)
	for path, want := range map[string]int{url: 200, URLPrefix + "..%2Fsecret.jpg": 404, URLPrefix + "nope.jpg": 404} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != want {
			t.Errorf("%s: status %d, want %d", path, rec.Code, want)
		}
	}
	if _, err := s.Save([]byte("x"), "image/gif"); err == nil {
		t.Error("gif should be rejected")
	}
}
