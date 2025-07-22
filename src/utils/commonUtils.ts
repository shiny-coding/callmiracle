/**
 * Generate a short 4-character request ID for easier reading
 * This matches the middleware implementation
 */
export function generateShortRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function formatGraphQLResponseError(responseData: any, operationName: string) {
  const errorMessage = responseData.errors.map((error: any) => error.extensions?.originalError?.message).join(', ')
  return [ `GraphQL ${operationName}: ${errorMessage}`, {
    operationName,
    errors: responseData.errors.map((err: any) => ({
      message: err.message,
      locations: err.locations,
      path: err.path,
      code: err.extensions?.code
    }))
  }]
}