package llm

import (
	"context"
	"sync"
	"time"
)

// limiter is a sliding-window requests-per-minute gate with a cooldown after 429/503.
type limiter struct {
	mu        sync.Mutex
	rpm       int
	sent      []time.Time
	coolUntil time.Time
}

func newLimiter(rpm int) *limiter { return &limiter{rpm: max(rpm, 1)} }

// reserve takes a slot if one is free now; otherwise it reports how long to wait.
func (l *limiter) reserve() (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if now.Before(l.coolUntil) {
		return false, l.coolUntil.Sub(now)
	}
	cutoff := now.Add(-time.Minute)
	i := 0
	for i < len(l.sent) && l.sent[i].Before(cutoff) {
		i++
	}
	l.sent = l.sent[i:]
	if len(l.sent) < l.rpm {
		l.sent = append(l.sent, now)
		return true, 0
	}
	return false, l.sent[0].Sub(cutoff)
}

func (l *limiter) wait(ctx context.Context) error {
	for {
		ok, d := l.reserve()
		if ok {
			return nil
		}
		select {
		case <-time.After(d + 10*time.Millisecond):
		case <-ctx.Done():
			return context.Cause(ctx)
		}
	}
}

func (l *limiter) cooldown(d time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if until := time.Now().Add(d); until.After(l.coolUntil) {
		l.coolUntil = until
	}
}
