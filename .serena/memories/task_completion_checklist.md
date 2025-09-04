# CallMiracle Task Completion Checklist

## When completing any development task:

### 1. Code Quality Checks
- [ ] Run `yarn lint` to check for ESLint issues
- [ ] Ensure TypeScript compilation with no errors (build process will check this)
- [ ] Verify all imports resolve correctly

### 2. GraphQL Changes
- [ ] If GraphQL schema modified, run `yarn codegen` to regenerate types
- [ ] Test GraphQL resolvers through the GraphQL playground at `/api/graphql`
- [ ] Ensure proper error handling and logging in resolvers

### 3. Testing & Verification
- [ ] Test functionality in development mode (`yarn dev`)
- [ ] Verify responsive design across different screen sizes
- [ ] Test internationalization if UI text was modified
- [ ] Check browser console for JavaScript errors
- [ ] Verify WebRTC functionality if video calling features modified

### 4. Build & Production Readiness
- [ ] Run `yarn build` to ensure production build succeeds
- [ ] Check for any build warnings or errors
- [ ] Verify no server-only packages imported on client side

### 5. Observability & Monitoring
- [ ] Check logs for proper structured logging
- [ ] Verify OpenTelemetry tracing is working if backend changes made
- [ ] Test with observability stack if significant changes made (`yarn observability:up`)

## No Formal Testing Framework
Note: This project does not have unit tests or integration tests configured. 
Verification is done through:
- Manual testing in development
- Build-time TypeScript checks
- ESLint static analysis
- Production observability monitoring

## Git & Version Control
- [ ] Commit messages should be descriptive
- [ ] Consider breaking changes and their impact
- [ ] Ensure no sensitive information (API keys, credentials) in commits

## Performance Considerations
- [ ] Check bundle size impact for client-side changes
- [ ] Verify image optimization settings if images modified
- [ ] Consider caching implications for API changes
- [ ] Test with realistic data volumes for database queries

## Security Checks
- [ ] Verify authentication/authorization for new endpoints
- [ ] Ensure input validation for user-facing features
- [ ] Check for potential XSS or injection vulnerabilities
- [ ] Review any new dependencies for security advisories