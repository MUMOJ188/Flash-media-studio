// Conditional logging utility - only logs in development mode
const isDevelopment = import.meta.env.DEV;

export const logger = {
  info: (...args: any[]) => isDevelopment && console.log('[INFO]', ...args),
  warn: (...args: any[]) => isDevelopment && console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args), // Always log errors
  debug: (...args: any[]) => isDevelopment && console.debug('[DEBUG]', ...args)
};
