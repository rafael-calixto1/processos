import dotenv from 'dotenv';
dotenv.config();

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const tokenCache = {
  accessToken: null,
  expiresAt: null,   // epoch ms
  refreshTimer: null
};

async function fetchNewToken() {
  const host = process.env.HUBSOFT_API_URL.replace(/\/$/, '');
  const body = new URLSearchParams({
    client_id: process.env.HUBSOFT_CLIENT_ID,
    client_secret: process.env.HUBSOFT_CLIENT_SECRET,
    username: process.env.HUBSOFT_USERNAME,
    password: process.env.HUBSOFT_PASSWORD,
    grant_type: process.env.HUBSOFT_GRANT_TYPE
  });

  const response = await fetch(`${host}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HubSoft auth failed [${response.status}]: ${text}`);
  }

  const data = await response.json();
  if (!data.access_token) throw new Error('HubSoft: no access_token in response');
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

function clearRefreshTimer() {
  if (tokenCache.refreshTimer) {
    clearInterval(tokenCache.refreshTimer);
    tokenCache.refreshTimer = null;
  }
}

function scheduleProactiveRefresh() {
  clearRefreshTimer();
  const timer = setInterval(async () => {
    console.log('[HubSoft] Proactive 24h token refresh');
    invalidateToken();
    try { await getToken(); } catch (err) {
      console.error('[HubSoft] Proactive refresh failed:', err.message);
    }
  }, REFRESH_INTERVAL_MS);
  timer.unref(); // don't block process exit
  tokenCache.refreshTimer = timer;
}

export function invalidateToken() {
  tokenCache.accessToken = null;
  tokenCache.expiresAt = null;
  clearRefreshTimer();
}

export async function getToken() {
  const now = Date.now();
  if (tokenCache.accessToken && tokenCache.expiresAt && now < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const { accessToken, expiresIn } = await fetchNewToken();
  tokenCache.accessToken = accessToken;
  tokenCache.expiresAt = now + expiresIn * 1000;
  scheduleProactiveRefresh();

  const days = Math.round(expiresIn / 86400);
  console.log(`[HubSoft] Token acquired — expires in ${days} day(s)`);
  return tokenCache.accessToken;
}
