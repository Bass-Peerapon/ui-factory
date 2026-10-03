package llm

import (
	"testing"
	"time"
)

func TestLimiter(t *testing.T) {
	l := newLimiter(2)
	for range 2 {
		if ok, _ := l.reserve(); !ok {
			t.Fatal("slot should be free")
		}
	}
	ok, wait := l.reserve()
	if ok || wait <= 0 || wait > time.Minute {
		t.Fatalf("third call should wait, got ok=%v wait=%v", ok, wait)
	}
	l2 := newLimiter(10)
	l2.cooldown(time.Second)
	if ok, _ := l2.reserve(); ok {
		t.Fatal("cooldown should block")
	}
}
