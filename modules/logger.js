const LOG_PREFIX = '[TaxonomyExplorer]';
const ENABLE_DEBUG = true;
const ENABLE_TRACE = true;

function formatMessage(level, message, data = null) {
  const timestamp = new Date().toISOString().substr(11, 8); // HH:MM:SS
  let formatted = `${LOG_PREFIX} ${timestamp} ${level.toUpperCase()}: ${message}`;

  if (data && typeof data === 'object') {
    formatted += ` | Data: ${JSON.stringify(data, null, 2)}`;
  }

  return formatted;
}

export function logInfo(message, data = null) {
  console.info(formatMessage('info', message, data));
}

export function logWarn(message, data = null) {
  console.warn(formatMessage('warn', message, data));
}

export function logError(message, error = null, data = null) {
  const errorMsg = error ? `${message} :: ${error?.message || error}` : message;
  console.error(formatMessage('error', errorMsg, data), error);
}

export function logDebug(message, data = null) {
  if (!ENABLE_DEBUG) return;
  console.debug(formatMessage('debug', message, data));
}

export function logTrace(message, data = null) {
  if (!ENABLE_TRACE) return;
  console.log(formatMessage('trace', message, data));
}
