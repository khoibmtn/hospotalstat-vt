---
description: Sync local changes to GitHub and deploy. Commits, pushes to main, and optionally deploys Firebase Functions.
---

# /sync - Sync & Deploy

$ARGUMENTS

---

## Purpose

Run comprehensive quality checks, commit all local changes, push to GitHub `main` branch (triggers auto-deploy), verify deployment health, and optionally deploy Firebase Cloud Functions.

---

## Sub-commands

```
/sync              - Full sync: all checks + commit + push + health check
/sync functions    - Also deploy Firebase Cloud Functions
/sync all          - Push to GitHub + deploy Firebase Functions
/sync status       - Check current git status and latest deploy
/sync --skip-checks - Skip pre-flight checks, commit + push directly
/sync rollback     - Rollback to previous deployment
```

---

## Steps

### Phase 1: Pre-Flight Checks

#### 1.1 TypeScript check
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && npx tsc --noEmit 2>&1 | tail -20
```

#### 1.2 ESLint check
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && npx eslint src --max-warnings 0 2>&1 | tail -20
```

#### 1.3 Build check
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && npm run build 2>&1 | tail -20
```

#### 1.4 Run tests (if available)
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && npm test 2>&1 | tail -20 || echo "⚠️ No tests configured"
```

#### 1.5 Security audit
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && npm audit --production 2>&1 | tail -10
```

#### 1.6 Check for hardcoded secrets
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && grep -rn "AIza\|sk-\|password\s*=" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -10
```

#### 1.7 Check for console.log statements
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | head -10
```

#### 1.8 Bundle size check
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && ls -lh dist/assets/*.js 2>/dev/null | awk '{print $5, $9}' || echo "Run build first"
```

> **Gate:** If any critical check fails (TypeScript errors, build failure, security vulnerabilities), STOP and report. Ask user whether to fix or proceed with `--skip-checks`.

---

### Phase 2: Commit & Push

#### 2.1 Check current git status
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && git status --short
```

#### 2.2 Stage all changes
// turbo
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && git add -A
```

#### 2.3 Commit with descriptive message
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && git commit -m "<message>"
```
> **Note:** Generate a concise, descriptive commit message. Use conventional format: `feat:`, `fix:`, `ui:`, `refactor:`, `docs:`, etc.

#### 2.4 Push to main
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && git push origin main 2>&1
```

---

### Phase 3: Post-Deploy Verification

#### 3.1 Wait for deploy (~60-90 seconds)
```bash
echo "⏳ Waiting 90s for deploy..." && sleep 90
```

#### 3.2 Health check
// turbo
```bash
curl -s -o /dev/null -w "HTTP Status: %{http_code}\nResponse Time: %{time_total}s\n" 
```

#### 3.3 Verify site is up
// turbo
```bash
curl -s -o /dev/null -w "%{http_code}"  && echo " - Main page OK"
```

---

### Phase 4: (Optional) Firebase Functions

Only if `/sync functions` or `/sync all`:
```bash
cd /Users/buiminhkhoi/Documents/Antigravity/HospotalStat-VT && firebase deploy --only functions --project  2>&1
```

---

## Output Format

```markdown
## ✅ Sync & Deploy Complete

### Pre-Flight
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 warnings
- ✅ Tests: passed
- ✅ Build: success
- ✅ Security: 0 vulnerabilities
- ✅ Secrets: clean
- ✅ Console.log: clean

### Git
- **Commit:** `abc1234` — feat: description
- **Branch:** main
- **Files changed:** N

### Deploy Verification
- ✅ Site responding: HTTP 200
- **URL:** 
```
