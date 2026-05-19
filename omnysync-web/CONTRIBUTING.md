# Contributing to Omnysync

## Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Fill in the required environment variables
4. Run `npm install`
5. Run `npm run db:setup`
6. Run `npm run dev`

## Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `chore/` - Maintenance tasks

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Refactoring
- `test:` - Tests
- `chore:` - Maintenance

## Pull Request Process

1. Create a new branch from `develop`
2. Make your changes
3. Run `npm run lint` and `npm run test`
4. Create a PR with a clear description
5. Wait for review
6. Squash and merge

## Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Use Prettier for formatting
- Write tests for new features

## Testing

```bash
npm run test      # Run tests
npm run test:watch # Watch mode
```
