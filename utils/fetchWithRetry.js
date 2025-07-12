// utils/fetchWithRetry.js
export const fetchWithRetry = async (
  url,
  options = {},
  retries = 5,
  delay = 1000
) => {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status === 429 && i < retries - 1) {
      const retryAfter = res.headers.get("Retry-After");
      const waitTime = retryAfter
        ? parseInt(retryAfter) * 1000
        : delay * 2 ** i;
      console.warn(`Rate limited. Retrying in ${waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } else {
      return res;
    }
  }
  throw new Error("API fetch failed with status 429 after retries");
};
