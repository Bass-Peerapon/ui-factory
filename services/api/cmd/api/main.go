// Command api serves the UI Factory backend: REST + SSE, agent pipeline and SQLite storage.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Bass-Peerapon/ui-factory/services/api/internal/catalog"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/composer"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/config"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/httpapi"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/hub"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/llm"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/pipeline"
	"github.com/Bass-Peerapon/ui-factory/services/api/internal/store"
)

func main() {
	if err := run(); err != nil {
		slog.Error("api stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg := config.Load()

	cat, err := catalog.Load()
	if err != nil {
		return err
	}
	st, err := store.Open(cfg.DatabasePath)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer st.Close()
	model, err := llm.NewGemini(ctx, llm.Options{
		APIKey: cfg.GeminiAPIKey, Model: cfg.GeminiModel, FastModel: cfg.GeminiFastModel,
		RPM: cfg.GeminiRPM, FastRPM: cfg.GeminiFastRPM,
	})
	if err != nil {
		return err
	}

	h := hub.New(st, cat)
	srv := &httpapi.Server{
		Hub:         h,
		FixturesDir: cfg.FixturesDir,
		ComposerURL: cfg.ComposerURL,
		Runner: &pipeline.Runner{
			Cat:        cat,
			Composer:   composer.New(cfg.ComposerURL, cfg.ComposerMode),
			Model:      model,
			MaxRetries: cfg.MaxRetries,
		},
	}
	httpSrv := &http.Server{Addr: fmt.Sprintf(":%d", cfg.Port), Handler: srv.Handler(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpSrv.Shutdown(shutdown)
	}()
	slog.Info("api listening", "port", cfg.Port, "db", cfg.DatabasePath, "composer", cfg.ComposerURL,
		"mode", cfg.ComposerMode, "model", cfg.GeminiModel, "fast", cfg.GeminiFastModel)
	if err := httpSrv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
