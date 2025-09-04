# CallMiracle Development Commands

## Primary Development Commands
- `yarn dev` - Start development server (custom script with port management)
- `yarn dev-fast` - Start dev server with Turbopack (no port cleanup)
- `yarn build` - Build the application for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint linting

## TypeScript
- No explicit typecheck command in scripts, but TypeScript is checked during build
- Run `npx tsc --noEmit` for manual type checking

## GraphQL
- `yarn codegen` - Generate TypeScript types from GraphQL schema
- GraphQL endpoint available at `/api/graphql`

## Docker & Observability
- `yarn observability:up` - Start observability stack (Loki, Grafana, Tempo)
- `yarn observability:down` - Stop observability stack
- `yarn observability:logs` - View observability logs
- `yarn docker:up` - Start main application in Docker
- `yarn docker:down` - Stop Docker containers

## Scaling & Redis
- `yarn scale:up` - Start scaled deployment with load balancer
- `yarn scale:down` - Stop scaled deployment
- `yarn redis:up` - Start Redis container
- `yarn redis:cli` - Access Redis CLI

## Utility Commands
- `yarn kill-port` - Kill processes on ports 3003, 9229, 9230
- `yarn test:observability` - Run observability integration tests

## Windows System Commands
Since this is a Windows environment, use these commands:
- `dir` (instead of `ls`) - List directory contents
- `cd` - Change directory
- `type filename` - View file contents (instead of `cat`)
- `find "pattern" filename` - Search in files (basic)
- `findstr "pattern" filename` - Better search (equivalent to `grep`)
- `del filename` - Delete files
- `rmdir /s foldername` - Remove directories
- `copy source destination` - Copy files
- `move source destination` - Move files
- `git` commands work normally

## Development Workflow
1. `yarn dev` to start development server
2. `yarn lint` to check code quality
3. `yarn codegen` when GraphQL schema changes
4. `yarn build` before production deployment
5. Use observability stack for monitoring during development