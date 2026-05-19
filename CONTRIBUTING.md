# Contributing to Saldoo

We love contributions! This document provides guidelines and instructions for contributing.

## 🎯 How to Contribute

1. **Report Issues** - Found a bug? [Create an issue](https://github.com/michalryskiewicz/saldoo/issues/new)
2. **Suggest Features** - Have an idea? [Start a discussion](https://github.com/michalryskiewicz/saldoo/discussions)
3. **Submit Code** - Ready to code? Follow the steps below

## 🚀 Getting Started

### Prerequisites

- **Bun** (latest) - [Install](https://bun.sh)
- **Docker** - [Install](https://www.docker.com)
- **Git** - [Install](https://git-scm.com)

### Setup Development Environment

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/saldoo.git
cd saldoo

# 3. Add upstream remote
git remote add upstream https://github.com/michalryskiewicz/saldoo.git

# 4. Install dependencies
bun install

# 5. Start local database
docker compose -f docker-compose.dev.yml up -d

# 6. Copy environment file
cp .env.example .env

# 7. Run development servers
bun run dev:backend  # Terminal 1
bun run dev:frontend # Terminal 2
```

## 📝 Code Style Guide

### TypeScript/JavaScript

```typescript
// Use descriptive names
function calculateMonthlyBudget(userId: string) {
  // Implementation
}

// Keep functions small and focused
// Use async/await over promises

// Add JSDoc comments for public functions
/**
 * Fetches user profile from database
 * @param userId - The unique user identifier
 * @returns User profile or null if not found
 */
export async function getUser(userId: string) {
  // Implementation
}
```

### React Components

```typescript
// Use functional components with hooks
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Side effects here
  }, [userId]);
  
  return (
    <div className="space-y-4">
      {/* Component content */}
    </div>
  );
}
```

### CSS/Tailwind

```html
<!-- Use Tailwind utility classes -->
<div className="flex items-center justify-between rounded-lg bg-slate-50 p-4 shadow-sm">
  <h3 className="text-lg font-semibold text-slate-900">Title</h3>
  <button className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
    Action
  </button>
</div>
```

### File Organization

```
src/
├── components/        # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   └── inputs/
├── features/          # Feature modules
│   ├── expenses/
│   ├── budgets/
│   └── analytics/
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
└── types/             # TypeScript type definitions
```

## 🔄 Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `style`

**Examples**:
```
feat(expenses): add expense filtering by date range
fix(auth): resolve Google OAuth token refresh issue
docs(readme): update installation instructions
test(api): add unit tests for exchange rate service
```

### Best Practices

- Keep commits focused and atomic
- Write meaningful commit messages
- Reference issues: `Fixes #123`
- Push regularly to avoid losing work

## 🧪 Testing

### Running Tests

```bash
# Run all tests
bun run test

# Watch mode
bun run test --watch

# Coverage report
bun run test --coverage
```

### Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateBudget } from './budget.ts';

describe('Budget Calculations', () => {
  let userId: string;
  
  beforeEach(() => {
    userId = 'test-user-123';
  });
  
  it('should calculate monthly budget correctly', () => {
    const result = calculateBudget(userId, 3000);
    expect(result.needs).toBe(1500);
    expect(result.wants).toBe(900);
    expect(result.savings).toBe(600);
  });
  
  it('should handle zero income', () => {
    const result = calculateBudget(userId, 0);
    expect(result.needs).toBe(0);
  });
});
```

## 🔍 Code Quality

### Linting & Formatting

```bash
# Check code style
bun run lint

# Auto-fix issues
bun run lint:fix

# Format code
bun run format:write
```

All code must pass linting before merging.

### Type Safety

- Always use TypeScript types
- Avoid `any` type - use proper generics
- Enable strict mode in tsconfig

## 📋 Pull Request Process

### Before Submitting

```bash
# 1. Sync with upstream
git fetch upstream
git rebase upstream/main

# 2. Test your changes
bun run test
bun run lint:fix

# 3. Push to your fork
git push origin feature/my-feature
```

### PR Template

```markdown
## Description
Brief description of changes

## Related Issue
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How to Test
Steps to test the changes

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

### Review Process

- A maintainer will review your PR
- Feedback may be requested
- Once approved, your PR will be merged!

## 🏗️ Architecture

### Backend Structure

```
apps/backend/
├── api/                 # Route handlers
├── auth.ts              # Auth configuration
├── middleware/          # Express middleware
├── prisma/              # Database schema
└── utils/               # Helper functions
```

### Frontend Structure

```
apps/frontend/src/
├── components/          # UI components
├── features/            # Feature modules
├── database/            # Local data (Dexie)
├── hooks/               # Custom hooks
├── store/               # Redux state
└── utils/               # Helpers
```

## 📚 Documentation

### Adding Docs

- Update README.md for user-facing changes
- Add JSDoc comments for functions
- Update CHANGELOG.md with significant changes
- Include examples for new features

### Example JSDoc

```typescript
/**
 * Fetches exchange rates for currency conversion
 * @param from - Source currency code (e.g., 'USD')
 * @param to - Target currency code (e.g., 'EUR')
 * @param date - Date for historical rates (optional)
 * @returns Exchange rate or null if not available
 * @throws {ExchangeRateError} If API call fails
 * 
 * @example
 * ```typescript
 * const rate = await getExchangeRate('USD', 'EUR');
 * console.log(rate); // 0.92
 * ```
 */
export async function getExchangeRate(
  from: string,
  to: string,
  date?: Date
): Promise<number | null> {
  // Implementation
}
```

## 🐛 Bug Reports

### Include

- **Description** - What happened vs. what was expected
- **Steps to Reproduce** - How to trigger the bug
- **Environment** - OS, browser, Bun version
- **Screenshots** - If applicable
- **Error Logs** - Console errors or stack traces

### Example

```markdown
## Bug: Database connection timeout

### Description
When starting dev environment, backend fails to connect to PostgreSQL

### Steps to Reproduce
1. Run `docker compose -f docker-compose.dev.yml up -d`
2. Run `bun run dev:backend`
3. Wait 5 seconds

### Expected
Backend starts successfully

### Actual
Error: "connect ECONNREFUSED 127.0.0.1:5432"

### Environment
- OS: macOS 14.0
- Bun: 1.2.0
- Docker: 26.0.0
```

## 🚦 Development Workflow

```
main ← develop ← feature branches
```

### Branch Naming

- `feature/user-authentication`
- `fix/exchange-rate-calculation`
- `docs/api-documentation`
- `refactor/database-queries`

### Merging

1. Create feature branch from `develop`
2. Submit PR when ready
3. After approval, PR is merged to `develop`
4. `develop` → `main` releases happen monthly

## 💬 Questions?

- **Issues**: [GitHub Issues](https://github.com/michalryskiewicz/saldoo/issues)
- **Website**: [https://rysiuo.it](https://rysiuo.it)
- **Email**: kontakt@rysiuo.it

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing to Saldoo! 🎉**

