/**
 * Logger abstraction - works in both CLI and GitHub Actions contexts
 */

import * as core from "@actions/core";

export interface Logger {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

/**
 * GitHub Actions logger - wraps @actions/core
 */
export class ActionsLogger implements Logger {
  info(message: string): void {
    core.info(message);
  }

  warning(message: string): void {
    core.warning(message);
  }

  error(message: string): void {
    core.error(message);
  }

  debug(message: string): void {
    core.debug(message);
  }
}

/**
 * Console logger for CLI usage
 */
export class ConsoleLogger implements Logger {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  info(message: string): void {
    console.log(message);
  }

  warning(message: string): void {
    console.log(`⚠️  ${message}`);
  }

  error(message: string): void {
    console.error(`❌ ${message}`);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(`🔍 ${message}`);
    }
  }
}

/**
 * Quiet logger - only outputs errors
 */
export class QuietLogger implements Logger {
  info(_message: string): void {}
  warning(_message: string): void {}
  error(message: string): void {
    console.error(message);
  }
  debug(_message: string): void {}
}

// Global logger instance - defaults to Actions logger for backward compat
let currentLogger: Logger = new ActionsLogger();

export function setLogger(logger: Logger): void {
  currentLogger = logger;
}

export function getLogger(): Logger {
  return currentLogger;
}

// Convenience exports that use the current logger
export const log = {
  info: (message: string) => currentLogger.info(message),
  warning: (message: string) => currentLogger.warning(message),
  error: (message: string) => currentLogger.error(message),
  debug: (message: string) => currentLogger.debug(message),
};
