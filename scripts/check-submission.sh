#!/usr/bin/env bash
# RadVault PACS Assessment — Submission Validator
# Usage: ./scripts/check-submission.sh /path/to/candidate/repo
# Or:    make check REPO=/path/to/candidate/repo

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((WARN++)); }

# --- Argument check ---
REPO="${1:?Usage: $0 /path/to/candidate/repo}"

if [ ! -d "$REPO" ]; then
  echo -e "${RED}Error: Directory not found: $REPO${NC}"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   RadVault Submission Validator                  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Checking: $REPO"
echo ""

# --- 1. Required Files ---
echo "▸ Required Files"

required_files=(
  "README.md"
  "docker-compose.yml:docker-compose.yaml"
)

for entry in "${required_files[@]}"; do
  IFS=':' read -ra alternatives <<< "$entry"
  found=false
  for alt in "${alternatives[@]}"; do
    if [ -f "$REPO/$alt" ]; then
      pass "$alt exists"
      found=true
      break
    fi
  done
  if [ "$found" = false ]; then
    fail "${alternatives[0]} missing"
  fi
done

# Time log
if [ -f "$REPO/TIMELOG.md" ] || [ -f "$REPO/templates/TIMELOG.md" ]; then
  pass "TIMELOG.md exists"
else
  fail "TIMELOG.md missing"
fi

# AI Retrospective
if [ -f "$REPO/AI_RETROSPECTIVE.md" ] || [ -f "$REPO/templates/AI_RETROSPECTIVE.md" ]; then
  pass "AI_RETROSPECTIVE.md exists"
else
  fail "AI_RETROSPECTIVE.md missing"
fi

echo ""

# --- 2. Docker Compose Validation ---
echo "▸ Docker Compose"

compose_file=""
if [ -f "$REPO/docker-compose.yml" ]; then
  compose_file="$REPO/docker-compose.yml"
elif [ -f "$REPO/docker-compose.yaml" ]; then
  compose_file="$REPO/docker-compose.yaml"
fi

if [ -n "$compose_file" ]; then
  if command -v docker &> /dev/null; then
    if docker compose -f "$compose_file" config --quiet 2>/dev/null; then
      pass "Docker Compose config is valid"
    else
      fail "Docker Compose config has errors"
    fi
  else
    warn "Docker not installed — skipping compose validation"
  fi

  # Check for services
  if grep -q "services:" "$compose_file"; then
    pass "Services defined in compose file"
  else
    fail "No services defined in compose file"
  fi
else
  fail "No docker-compose file found"
fi

echo ""

# --- 3. Infrastructure as Code ---
echo "▸ Infrastructure as Code"

iac_found=false
if find "$REPO" -name "*.tf" -not -path "*/node_modules/*" -not -path "*/.git/*" | head -1 | grep -q .; then
  pass "Terraform files found (.tf)"
  iac_found=true
fi
if find "$REPO" -name "Pulumi.yaml" -not -path "*/node_modules/*" -not -path "*/.git/*" | head -1 | grep -q .; then
  pass "Pulumi configuration found"
  iac_found=true
fi
if [ "$iac_found" = false ]; then
  fail "No IaC files found (Terraform .tf or Pulumi.yaml)"
fi

echo ""

# --- 4. CI/CD Pipeline ---
echo "▸ CI/CD Pipeline"

cicd_found=false
if [ -d "$REPO/.github/workflows" ] && find "$REPO/.github/workflows" -name "*.yml" -o -name "*.yaml" | head -1 | grep -q .; then
  pass "GitHub Actions workflows found"
  cicd_found=true
fi
if [ -f "$REPO/.gitlab-ci.yml" ]; then
  pass "GitLab CI config found"
  cicd_found=true
fi
if [ "$cicd_found" = false ]; then
  fail "No CI/CD pipeline definition found"
fi

echo ""

# --- 5. Tests ---
echo "▸ Test Suite"

test_found=false
patterns=("*test*" "*spec*" "*_test.*" "*_spec.*" "test_*" "spec_*")
for pattern in "${patterns[@]}"; do
  if find "$REPO" -name "$pattern" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/vendor/*" | head -1 | grep -q .; then
    test_found=true
    break
  fi
done

if [ "$test_found" = true ]; then
  test_count=$(find "$REPO" -name "*test*" -o -name "*spec*" | grep -v node_modules | grep -v .git | grep -v vendor | wc -l)
  pass "Test files found (~$test_count files)"
else
  fail "No test files found"
fi

echo ""

# --- 6. API Documentation ---
echo "▸ API Documentation"

api_doc_found=false
if find "$REPO" -name "openapi*" -o -name "swagger*" -o -name "*.openapi.*" | head -1 | grep -q .; then
  pass "OpenAPI/Swagger spec file found"
  api_doc_found=true
fi
if [ "$api_doc_found" = false ]; then
  warn "No OpenAPI/Swagger spec file found (may be auto-generated at runtime)"
fi

echo ""

# --- 7. Secret Scanning ---
echo "▸ Secret Scanning"

secret_patterns=(
  'password\s*=\s*["\x27][^"\x27]{4,}'
  'secret\s*=\s*["\x27][^"\x27]{4,}'
  'api_key\s*=\s*["\x27][^"\x27]{4,}'
  'AWS_SECRET_ACCESS_KEY'
  'PRIVATE.KEY'
)

secrets_found=false
for pattern in "${secret_patterns[@]}"; do
  matches=$(grep -rl "$pattern" "$REPO" \
    --include="*.py" --include="*.js" --include="*.ts" --include="*.go" \
    --include="*.java" --include="*.yml" --include="*.yaml" --include="*.json" \
    --include="*.env" --include="*.cfg" --include="*.conf" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=vendor \
    2>/dev/null || true)

  if [ -n "$matches" ]; then
    secrets_found=true
    for f in $matches; do
      relative="${f#$REPO/}"
      # Skip test/example/template files
      if echo "$relative" | grep -qiE "(test|spec|example|template|mock|fixture|sample)"; then
        continue
      fi
      warn "Possible secret in: $relative (pattern: $pattern)"
    done
  fi
done

if [ "$secrets_found" = false ]; then
  pass "No obvious hardcoded secrets detected"
fi

echo ""

# --- 8. Git History ---
echo "▸ Git History"

if [ -d "$REPO/.git" ]; then
  commit_count=$(git -C "$REPO" rev-list --count HEAD 2>/dev/null || echo "0")
  if [ "$commit_count" -gt 1 ]; then
    pass "Git history present ($commit_count commits)"
  elif [ "$commit_count" -eq 1 ]; then
    warn "Only 1 commit — expected incremental history"
  else
    warn "Could not read git history"
  fi

  # Check for v1.0.0 tag
  if git -C "$REPO" tag -l | grep -q "v1.0.0"; then
    pass "v1.0.0 tag found"
  else
    warn "No v1.0.0 tag found (expected for final submission)"
  fi
else
  warn "Not a git repository"
fi

echo ""

# --- Summary ---
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}Passed:${NC}  $PASS"
echo -e "  ${RED}Failed:${NC}  $FAIL"
echo -e "  ${YELLOW}Warnings:${NC} $WARN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -eq 0 ]; then
  echo -e "\n${GREEN}All checks passed.${NC} Ready for review.\n"
  exit 0
else
  echo -e "\n${RED}$FAIL check(s) failed.${NC} Review the issues above.\n"
  exit 1
fi
