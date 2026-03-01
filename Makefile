.PHONY: check help

REPO ?= .

help: ## Show this help
	@echo "RadVault PACS Assessment — Tooling"
	@echo ""
	@echo "Usage:"
	@echo "  make check REPO=/path/to/candidate/repo   Validate a submission"
	@echo "  make help                                  Show this help"
	@echo ""

check: ## Validate a candidate submission
	@bash scripts/check-submission.sh $(REPO)
