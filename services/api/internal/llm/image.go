package llm

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/genai"
)

// ErrNoImageModel means GEMINI_IMAGE_MODEL is empty, so pages keep their described placeholders.
var ErrNoImageModel = errors.New("image model is not configured")

// ImageModel draws photographs for the image slots of a page.
type ImageModel interface {
	// GenerateImage returns encoded image bytes and their MIME type. Aspect is one of the ratios
	// Gemini accepts, e.g. "16:9" or "4:3".
	GenerateImage(ctx context.Context, prompt, aspect string) ([]byte, string, error)
}

func (g *Gemini) GenerateImage(ctx context.Context, prompt, aspect string) ([]byte, string, error) {
	if g.image.name == "" {
		return nil, "", ErrNoImageModel
	}
	cfg := &genai.GenerateContentConfig{
		ResponseModalities: []string{"IMAGE"},
		ImageConfig:        &genai.ImageConfig{AspectRatio: aspect},
	}
	var lastErr error
	for range maxAttempts {
		if err := g.image.lim.wait(ctx); err != nil {
			return nil, "", err
		}
		res, err := g.client.Models.GenerateContent(ctx, g.image.name, genai.Text(prompt), cfg)
		if err == nil {
			for _, c := range res.Candidates {
				if c.Content == nil {
					continue
				}
				for _, p := range c.Content.Parts {
					if p.InlineData != nil && len(p.InlineData.Data) > 0 {
						return p.InlineData.Data, p.InlineData.MIMEType, nil
					}
				}
			}
			return nil, "", fmt.Errorf("gemini %s returned no image", g.image.name)
		}
		lastErr = fmt.Errorf("gemini %s: %w", g.image.name, err)
		if ctx.Err() != nil || !overloaded(err) {
			return nil, "", lastErr
		}
		backoff(g.image, err)
	}
	return nil, "", lastErr
}
