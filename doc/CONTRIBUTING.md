# Contributing to Sketch.ai

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and add your OpenAI API key
4. Run dev server: `npm run dev`

## Development Workflow

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Follow existing patterns
- **Naming**: camelCase for functions, PascalCase for types
- **Comments**: JSDoc for public functions

### Testing

```bash
npm test          # Run all tests
npm test -- --watch   # Watch mode
```

**Requirements:**
- All new features must have tests
- Maintain >80% coverage
- Tests must pass before PR

### Adding a New Agent

See [AGENTS.md](AGENTS.md#adding-a-new-agent) for detailed instructions.

### Adding a New API Endpoint

1. Create route in `src/app/api/[endpoint]/route.ts`
2. Add Zod schema in `src/lib/validators.ts`
3. Add types in `src/types/index.ts`
4. Write tests
5. Document in [API.md](API.md)

## Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run `npm test` and `npm run lint`
4. Submit PR with clear description
5. Address review feedback

## Reporting Issues

Include:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Screenshots if relevant
- Environment details
