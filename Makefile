.PHONY: dev install gen test typecheck eval audit build

install: ## install JS deps and Go modules
	pnpm install
	cd services/api && go mod download

dev: ## run api, composer and web together (reads .env)
	./scripts/dev.sh

gen: ## regenerate JSON Schema from the Zod catalog
	pnpm gen:schema

test: ## Go tests and catalog fixture check
	cd services/api && go test ./...
	pnpm --filter @ui-factory/catalog check

typecheck:
	pnpm -r typecheck
	cd services/api && go vet ./...

eval: ## run the jev vs llm composer evaluation (calls Jev and Gemini directly)
	pnpm eval

audit: ## run impeccable's detector on rendered fixtures (needs make dev); PROJECT=<id> audits a saved project
	node scripts/design-audit.mjs $(if $(PROJECT),--project $(PROJECT))

build:
	pnpm --filter @ui-factory/web build
	cd services/api && go build -o ../../bin/api ./cmd/api
