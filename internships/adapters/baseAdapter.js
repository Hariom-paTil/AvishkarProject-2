/**
 * Base Source Adapter Interface
 * All external and partner data sources must extend this class.
 */

const { SourceStatus } = require("../types/internshipTypes");

class BaseSourceAdapter {
  /**
   * @param {string} name - Human-readable source name
   * @param {Object} [options={}]
   */
  constructor(name, options = {}) {
    if (!name) throw new Error("Adapter name is required.");
    this.name = name;
    this.enabled = options.enabled !== false;
    this.timeoutMs = options.timeoutMs || Number(process.env.INTERNSHIP_SOURCE_TIMEOUT_MS || 7000);
  }

  /**
   * Check whether this source is configured and ready for queries.
   * @returns {boolean}
   */
  isConfigured() {
    return this.enabled;
  }

  /**
   * Execute search across the source.
   * Must be overridden by subclasses.
   * @param {Object} query - Structured query object
   * @param {Object} [options={}]
   * @returns {Promise<{
   *   source: string,
   *   status: string,
   *   durationMs: number,
   *   resultCount: number,
   *   listings: Array,
   *   errorMessage: string|null,
   *   isConfigured: boolean
   * }>}
   */
  async search(query, options = {}) {
    throw new Error(`search() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Safe fetch with strict timeout and error capture.
   * @protected
   * @param {string} url
   * @param {RequestInit} [init={}]
   * @returns {Promise<Response>}
   */
  async safeFetch(url, init = {}) {
    const timeout = init.timeout || this.timeoutMs;
    const signal = AbortSignal.timeout(timeout);

    return fetch(url, {
      ...init,
      signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SkillBridge-CareerBot/2.0 (+https://skillbridge.ai)",
        ...(init.headers || {})
      }
    });
  }

  /**
   * Standard result wrapper
   * @protected
   */
  buildResult({ status, durationMs, listings = [], errorMessage = null }) {
    return {
      source: this.name,
      status,
      durationMs: Math.round(durationMs),
      resultCount: listings.length,
      listings,
      errorMessage,
      isConfigured: this.isConfigured()
    };
  }
}

module.exports = BaseSourceAdapter;
