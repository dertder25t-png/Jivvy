# AI & Developer Context

## Build Optimization Strategy

To achieve faster deployment times on Vercel, the build process has been optimized by skipping time-consuming checks that should instead be performed locally.

> [!IMPORTANT]
> **ALL code must be checked locally before pushing to production or triggering a deployment.**

### Skipped Build-Time Checks
The following checks are explicitly disabled in `next.config.ts`:
- **TypeScript Type-Checking**: `ignoreBuildErrors: true`
- **ESLint Linting**: `ignoreDuringBuilds: true`

### Required Local Verification
Before every push to `main` or any deployment branch, developers/AI assistants MUST run:
1. `npm run lint` - To ensure code style and common issues are addressed.
2. `npx tsc --noEmit` - To ensure type safety.
3. `npm run build` - To verify the project compiles correctly.

### Optimized Imports
`next.config.ts` uses `optimizePackageImports` for heavy libraries:
- `lucide-react`
- `date-fns`

This reduces the bundle size and speeds up the build by only including the necessary components and functions.
