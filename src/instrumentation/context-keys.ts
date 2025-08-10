/**
 * Shared OpenTelemetry context keys for the application
 */
import { createContextKey } from '@opentelemetry/api'

// Context key for storing user ID across the trace
export const USER_ID_CONTEXT_KEY = createContextKey('callmiracle.user_id')