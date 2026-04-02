# AGENTS.md - AI-message VS Code Extension

## Build / Lint / Test Commands

```bash
# Install dependencies
npm install

# Type check only
npm run check-types

# Lint
npm run lint                    # runs: eslint src

# Compile (type-check + lint + bundle)
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch

# Package for release (production build, minified)
npm run package

# Run all tests (requires pretest: compile-tests + compile + lint)
npm test

# Compile tests only
npm run compile-tests

# Watch tests only
npm run watch-tests
```

**Running a single test:** Tests use `@vscode/test-cli`. Edit `src/test/extension.test.ts` and run:
```bash
npm test -- --grep "your test name"
```

## Code Style Guidelines

### TypeScript Configuration
- **Module system:** `Node16` (ESM imports, CJS output via esbuild)
- **Target:** `ES2022`
- **Strict mode:** enabled (`strict: true` in tsconfig.json)
- **Source maps:** enabled for debugging

### Formatting (.editorconfig)
- **Indentation:** 2 spaces (tabs prohibited)
- **Line endings:** LF
- **Charset:** UTF-8
- **Trailing whitespace:** trimmed (except `.md` files)
- **Final newline:** required

### ESLint Rules (eslint.config.mjs)
- `curly`: warn — always use curly braces for control statements
- `eqeqeq`: warn — use `===` and `!==` over `==` and `!=`
- `no-throw-literal`: warn — only throw `Error` objects
- `semi`: warn — semicolons required
- `@typescript-eslint/naming-convention`: warn — imports use `camelCase` or `PascalCase`

### Naming Conventions
- **Files:** camelCase (e.g., `aiService.ts`, `gitService.ts`)
- **Classes:** PascalCase (e.g., `GitService`, `SvnService`)
- **Functions/variables:** camelCase
- **Interfaces:** PascalCase, prefixed with `I` not required (e.g., `VcsService`)
- **Constants:** UPPER_SNAKE_CASE for true constants
- **Config keys:** kebab-case in `package.json` (e.g., `aiMessage.ai.provider`)

### Imports & Dependencies
- No external runtime dependencies — only `devDependencies`
- Bundle with esbuild, output format is CJS (`dist/extension.js`)
- `vscode` module is marked external (VS Code API)
- Use relative imports for internal modules

### Error Handling
- Always throw `Error` objects, never strings (`no-throw-literal`)
- Use try/catch with user-facing error messages via `vscode.window.showErrorMessage`
- Implement fallback mechanisms (see `enableFallback` config)
- Log errors via output channel, not console in production

### Architecture Patterns
- **Factory pattern:** `vcsFactory.ts`, `aiProviderFactory.ts` for creating services
- **Interface-driven design:** `vcsInterface.ts`, `aiInterface.ts` define contracts
- **Provider pattern:** `src/providers/` contains individual AI provider implementations
- **Service layer:** Separate services for VCS operations (`gitService.ts`, `svnService.ts`) and AI (`aiService.ts`)

### VS Code Extension Conventions
- Commands registered in `package.json` under `contributes.commands`
- Configuration namespace: `aiMessage.*`
- Use `vscode.ExtensionContext` for extension lifecycle
- Output channel for logging: "AI Message"
- Progress reporting via `vscode.window.withProgress`

### Git Workflow
- Commit messages follow conventional commit format with emoji support
- Branch naming: feature/, fix/, docs/, refactor/ prefixes
- Do not commit changes unless explicitly requested
