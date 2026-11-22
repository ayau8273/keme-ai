/**
 * Backend integration points for the Keme AI landing page.
 *
 * The site is front-end only for now. Every action that needs a server goes
 * through this file, so connecting the backend means filling in ENDPOINTS
 * (or replacing `post`) — the UI does not need to change.
 *
 * While an endpoint is `null`, calls resolve with `{ ok: true, mock: true }`
 * and nothing leaves the browser. The UI tells the user that explicitly.
 */

/** @typedef {'ru' | 'kk' | 'en'} Lang */
/** @typedef {'sup' | 'mkt' | 'hr'} AgentId */

/**
 * @typedef {Object} DeveloperApplication
 * @property {string} name          Developer or team name
 * @property {string} contact       Email or Telegram @username
 * @property {string} agentName     Agent name
 * @property {string} task          Business task the agent solves
 * @property {string} capabilities  Capabilities and limits
 * @property {'widget'|'messenger'|'api'|'other'} launch  How the agent runs
 * @property {Lang[]} languages     Supported languages
 * @property {Lang} locale          Site language at submission time
 */

/**
 * @typedef {Object} ConnectionRequest
 * @property {AgentId} agent        Requested agent
 * @property {string} company       Company name
 * @property {string} contact       Email or Telegram @username
 * @property {string} need          Task the business wants to hand off
 * @property {Lang} locale
 */

/**
 * @typedef {Object} SubmitResult
 * @property {boolean} ok
 * @property {boolean} [mock]   true while no endpoint is configured
 * @property {string} [error]
 */

export const ENDPOINTS = {
  developerApplication: null, // e.g. '/api/developer-applications'
  connectionRequest: null,    // e.g. '/api/connection-requests'
};

/**
 * Demo availability per agent. When a real demo page exists, put its URL here:
 * the agent card then shows an active «Попробовать демо» link.
 * @type {Record<AgentId, { liveDemoUrl: string | null }>}
 */
export const AGENT_DEMOS = {
  sup: { liveDemoUrl: null },
  mkt: { liveDemoUrl: null },
  hr: { liveDemoUrl: null },
};

/** @returns {Promise<SubmitResult>} */
async function post(url, payload) {
  if (!url) return { ok: true, mock: true };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** @param {DeveloperApplication} data */
export const submitDeveloperApplication = (data) => post(ENDPOINTS.developerApplication, data);

/** @param {ConnectionRequest} data */
export const submitConnectionRequest = (data) => post(ENDPOINTS.connectionRequest, data);
