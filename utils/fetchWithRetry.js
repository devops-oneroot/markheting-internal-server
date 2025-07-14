// utils/fetchWithRetry.js
export const fetchWithRetry = async (
  url,
  options = {},
  retries = 8, // Increased retries
  baseDelay = 2000 // Increased base delay
) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1}/${retries} for ${url}`);

      const res = await fetch(url, {
        ...options,
        timeout: 30000, // 30 second timeout
      });

      if (res.status === 429) {
        if (i < retries - 1) {
          // Check for Retry-After header
          const retryAfter = res.headers.get("Retry-After");
          let waitTime;

          if (retryAfter) {
            waitTime = parseInt(retryAfter) * 1000;
          } else {
            // Exponential backoff with jitter
            waitTime = Math.min(
              baseDelay * Math.pow(2, i) + Math.random() * 1000,
              60000 // Max 60 seconds
            );
          }

          console.warn(
            `Rate limited (429). Waiting ${waitTime}ms before retry ${i + 1}...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return res;
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }

      console.warn(`Request failed: ${error.message}. Retrying...`);
      const waitTime = baseDelay * Math.pow(2, i);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
};
