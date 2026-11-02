# Connect Gemini while keeping GitHub Pages

Your website stays at https://garikotanishant.github.io/common-hub/.
The Gemini key belongs in Netlify's private environment variables, never in a GitHub file.

1. Sign in at https://app.netlify.com/start and import the existing **garikotanishant/common-hub** GitHub repository. Choose the free plan. The repository already contains the build command and function settings.
2. Before deploying, add an environment variable named **GEMINI_API_KEY**. Paste your key into its private value field. Mark it as a secret if that option is offered, and include the **Functions** scope. Do not add it to netlify.toml or assistant-config.js. Leave Gemini billing disabled if you want only its free allowance.
3. Deploy. Netlify hosts the small `/api/chat` backend. It also creates a copy of the static pages; your GitHub Pages URL continues working.
4. Give the Netlify project URL to Codex to connect your GitHub Pages assistant. This URL is public and contains no secret. Or run `node scripts/connect-backend.mjs https://YOUR-PROJECT.netlify.app` from the repository, then commit the changed `assistant-config.js`.

If you add or change the key after deployment, redeploy on Netlify for the function to use it.

## What the assistant does

- Answers community-resource questions with Gemini 3.1 Flash-Lite, using matching entries from the catalog.
- Links to real catalog records; the backend rejects resource IDs invented by the model.
- Keeps existing local search, page navigation, saved places, and email-draft controls.
- Uses the same minimal DM Sans header as the website.
- Sends a question and at most six recent messages to Google only after the visitor opts in to Gemini.
- Falls back to directory links when the provider is unavailable or a request limit is reached.

The backend limits requests by IP, caps message and answer length, and allows browser calls only from the Netlify project and your GitHub Pages origin. These reduce casual abuse; a public anonymous endpoint can still consume a free quota. No chat or key is written to application logs. The server's health response shows only whether a key is configured, never the key itself.

The model can be changed using the optional private environment variable `GEMINI_MODEL`. Verify the chosen model's availability and free tier before changing it. Default: `gemini-3.1-flash-lite`.

## Local verification

Run `node scripts/build-netlify.mjs`, then `node --test tests/gemini.test.mjs`. Tests use a fake provider and never need your key. Static preview alone keeps the local helper; a Netlify function runtime is required for Gemini requests.

## Connection recovery

The widget keeps the Gemini opt-in visible when its health check fails. It retries when reopened, when the browser comes online, or when a visitor selects **Retry Gemini connection**. A consented question can retry chat directly, so a failed initial health check cannot disable Gemini for the rest of the tab. A network failure is shown separately from local directory features.

Run `npm ci` and `npm test` to check both the server and widget recovery behavior. The **Verify community assistant** workflow also checks the deployed backend from GitHub’s network on main-branch pushes. Its live check is advisory because provider outages or quota limits can occur independently of code changes.

The server uses Gemini 3’s default temperature and minimal thinking for Flash-Lite, with a 40-second provider deadline and a 50-second browser deadline. This avoids prematurely abandoning slow generations. Incomplete JSON and timeouts are reported separately without exposing provider text or credentials. The health check includes the public deployed commit revision so live verification waits for the new Netlify release.
