#!/usr/bin/env bash
# AGENTS.md §4 rule 2 guard: no .docx outside templates/ and fixtures/, no tracked env files,
# no API-key-looking strings. Reads `git ls-files`, so untracked build output (dist/) is ignored.
set -euo pipefail
fail=0

bad_docx=$(git ls-files '*.docx' | grep -Ev '^(templates|fixtures)/' || true)
if [ -n "$bad_docx" ]; then echo "::error::.docx outside templates/ and fixtures/: $bad_docx"; fail=1; fi

env_files=$(git ls-files | grep -E '(^|/)\.env(\..*)?$' | grep -v '\.env\.example$' || true)
if [ -n "$env_files" ]; then echo "::error::tracked env file: $env_files"; fail=1; fi

if git grep -nIE 'sk-ant-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----' -- . ':!package-lock.json' ':!scripts/check-repo-policy.sh'; then
  echo "::error::API-key-like string found"; fail=1
fi

exit $fail
