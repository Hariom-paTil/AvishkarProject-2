/**
 * Shared AI Client — Groq API wrapper
 * Handles model fallback, JSON extraction, retries, and error normalization.
 */

const GROQ_MODELS = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b"
];

const DEFAULT_TEMPERATURE = 0.5;
const DEFAULT_MAX_TOKENS = 4096;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Call the Groq API with automatic model fallback.
 * @param {Object} options
 * @param {string} options.systemPrompt
 * @param {string} options.userPrompt
 * @param {number} [options.temperature]
 * @param {number} [options.maxTokens]
 * @param {boolean} [options.jsonMode] - Request JSON response format
 * @returns {Promise<string>} Raw response content
 */
async function callGroq({ systemPrompt, userPrompt, temperature, maxTokens, jsonMode = true }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new AIClientError("GROQ_API_KEY is not configured.", "CONFIG_MISSING");
  }

  let lastError = null;

  for (const model of GROQ_MODELS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: temperature ?? DEFAULT_TEMPERATURE,
          max_tokens: maxTokens ?? DEFAULT_MAX_TOKENS,
          ...(jsonMode ? { response_format: { type: "json_object" } } : {})
        })
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        lastError = new AIClientError("Rate limited by AI provider.", "RATE_LIMIT");
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        lastError = new AIClientError(`Model ${model} returned ${response.status}: ${errorText}`, "API_ERROR");
        continue;
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message || {};
      const content = (message.content || "").trim();

      if (content) return content;

      // Some models put JSON in reasoning field
      const reasoning = (message.reasoning || "").trim();
      const jsonFromReasoning = reasoning.match(/\{[\s\S]*\}/);
      if (jsonFromReasoning) return jsonFromReasoning[0];

      lastError = new AIClientError(`Model ${model} returned empty content.`, "EMPTY_RESPONSE");
    } catch (error) {
      if (error.name === "AbortError") {
        lastError = new AIClientError(`Model ${model} timed out after ${REQUEST_TIMEOUT_MS}ms.`, "TIMEOUT");
      } else if (error instanceof AIClientError) {
        lastError = error;
      } else {
        lastError = new AIClientError(error.message || "Unknown network error", "NETWORK_ERROR");
      }
    }
  }

  throw lastError || new AIClientError("All AI models failed.", "ALL_MODELS_FAILED");
}

/**
 * Call Groq and parse the response as JSON.
 * Handles common edge cases like markdown code fences.
 * @param {Object} options - Same as callGroq
 * @returns {Promise<Object>} Parsed JSON object
 */
async function callGroqJSON(options) {
  const raw = await callGroq({ ...options, jsonMode: true });
  return parseAIJSON(raw);
}

/**
 * Parse AI response text as JSON with fallback extraction.
 * @param {string} text
 * @returns {Object}
 */
function parseAIJSON(text) {
  if (!text || !text.trim()) {
    throw new AIClientError("AI returned empty response.", "PARSE_ERROR");
  }

  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Try extracting JSON object or array
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (_) {
        // Fall through
      }
    }
    throw new AIClientError("Failed to parse AI response as JSON.", "PARSE_ERROR");
  }
}

/**
 * Custom error class for AI client failures.
 */
class AIClientError extends Error {
  constructor(message, code = "UNKNOWN") {
    super(message);
    this.name = "AIClientError";
    this.code = code;
  }
}

module.exports = { callGroq, callGroqJSON, parseAIJSON, AIClientError };
