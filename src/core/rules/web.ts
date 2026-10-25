import type { Rule, RuleHit, SourceFile } from "../types.js";
import { isCode, isTestFile, JS_EXT, redact, scanLines } from "./helpers.js";

function isServerHandler(f: SourceFile): boolean {
  return (
    /(^|\/)(app\/.*\/route|pages\/api\/.*|api\/.*|supabase\/functions\/.*\/index|functions\/.*|netlify\/functions\/.*|server\/.*|routes\/.*)\.(t|j)sx?$/.test(f.path) ||
    /\b(app|router)\.(get|post|put|patch|delete)\(/.test(f.content) ||
    /\bDeno\.serve\(|\bserve\(\s*async/.test(f.content)
  );
}

export const stripeWebhookUnverified: Rule = {
  id: "payments.webhook-unverified",
  title: "Payment webhook does not verify its signature",
  severity: "critical",
  category: "security",
  why: "Without signature verification anyone can POST a fake `checkout.session.completed` event to your webhook URL and get a paid plan for free. This exact bug shows up repeatedly in Lovable/Bolt apps.",
  fix: "Read the raw body and call `stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)` (or `constructEventAsync` on Deno/Edge). Reject the request on failure. For other providers use their HMAC signature check.",
  references: ["https://docs.stripe.com/webhooks#verify-events"],
  check(project) {
    const hits: RuleHit[] = [];
    for (const f of project.files) {
      if (!isCode(f) || isTestFile(f)) continue;
      const looksLikeWebhook =
        /webhook/i.test(f.path) ||
        /checkout\.session\.completed|invoice\.paid|customer\.subscription\.|payment_intent\.succeeded|order_created|subscription_created|payment\.captured/.test(f.content);
      if (!looksLikeWebhook || !isServerHandler(f)) continue;
      const verified =
        /constructEvent(Async)?\s*\(|validateWebhookSignature|verifyWebhook|webhooks\.unwrap|createHmac\(|crypto\.subtle\.(verify|sign)|timingSafeEqual|svix|verifySignature|Webhook\(\s*.*secret/i.test(f.content);
      if (verified) continue;
      const idx = f.lines.findIndex((l) => /event\.type|\.type\s*===?\s*["'](checkout|invoice|customer|payment)/.test(l));
      const line = idx >= 0 ? idx + 1 : 1;
      hits.push({ file: f.path, line, snippet: redact(f.lines[line - 1] ?? "") });
    }
    return hits;
  },
};

export const clientControlledPrice: Rule = {
  id: "payments.client-controlled-amount",
  title: "Checkout amount comes from the client",
  severity: "high",
  category: "security",
  why: "If the server trusts a price or amount sent by the browser, a user can change it to 1 cent before paying.",
  fix: "Send only a product/price ID from the client, and look up the amount on the server (Stripe Price IDs, or your own price table).",
  check(project) {
    return scanLines(project, /\b(unit_amount|amount|price)\s*:\s*(req\.body|body|request\.body|params|data)\.\w*(amount|price|total)/i, {
      files: (f) => isCode(f) && isServerHandler(f),
    });
  },
};

export const unauthenticatedWriteRoute: Rule = {
  id: "auth.unprotected-api-route",
  title: "API route changes data without checking who is calling",
  severity: "high",
  category: "security",
  why: "A server route that writes to the database without verifying the session can be called by anyone with curl — often with a service-role client that skips RLS entirely.",
  fix: "Authenticate at the top of every handler (e.g. `const { data: { user } } = await supabase.auth.getUser()` / `auth()` / `getServerSession()`), return 401 when missing, and scope the write to that user. Put this in shared middleware so new routes are protected by default.",
  check(project) {
    const hits: RuleHit[] = [];
    for (const f of project.files) {
      if (!JS_EXT.test(f.path) || isTestFile(f) || f.clientSide || !isServerHandler(f)) continue;
      if (/webhook|cron/i.test(f.path)) continue;
      const writes = /\.(insert|update|upsert|delete)\(|prisma\.\w+\.(create|update|upsert|delete)|\.(save|destroy|deleteOne|updateOne|insertOne)\(|db\.(insert|update|delete)\(/;
      if (!writes.test(f.content)) continue;
      const authed =
        /auth\.getUser|getSession|getServerSession|auth\(\)|currentUser|getAuth|requireAuth|requireUser|withAuth|verifyIdToken|jwt\.verify|jwtVerify|clerk|authenticate|isAuthenticated|req\.user|ctx\.user|session\.user|authorization/i.test(
          f.content,
        );
      if (authed) continue;
      const idx = f.lines.findIndex((l) => writes.test(l));
      hits.push({ file: f.path, line: idx + 1, snippet: redact(f.lines[idx] ?? ""), title: `Possibly unauthenticated write in ${f.path}` });
    }
    return hits;
  },
};

export const corsWildcard: Rule = {
  id: "web.cors-wildcard",
  title: "CORS allows any origin",
  severity: "medium",
  category: "security",
  why: "`Access-Control-Allow-Origin: *` lets any website call your API from a visitor's browser. Combined with cookies or a reflected origin it enables cross-site data theft.",
  fix: "Allow-list your own domains (e.g. from an `ALLOWED_ORIGINS` env var) and never combine a wildcard or reflected origin with credentials.",
  check(project) {
    return scanLines(project, /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']|origin\s*:\s*(["']\*["']|true)\b|\bcors\(\s*\)/i);
  },
};

export const dangerousEval: Rule = {
  id: "web.eval",
  title: "Dynamic code execution (eval / new Function)",
  severity: "high",
  category: "security",
  why: "Evaluating strings as code turns any injection into full code execution, in the browser (XSS) or on the server (RCE).",
  fix: "Replace with JSON.parse, a lookup table or a proper parser. There is almost never a legitimate need for eval in app code.",
  check(project) {
    return scanLines(project, /(^|[^.\w])eval\s*\(|new\s+Function\s*\(/, { files: (f) => isCode(f) && !f.path.endsWith(".py") });
  },
};

export const xssHtml: Rule = {
  id: "web.xss-raw-html",
  title: "Unsanitised HTML rendered into the page",
  severity: "high",
  category: "security",
  why: "Rendering user- or AI-generated HTML without sanitising it lets attackers run scripts in your users' sessions and steal their tokens.",
  fix: "Render text instead of HTML, or sanitise with DOMPurify (`DOMPurify.sanitize(html)`) right before rendering. Add a Content-Security-Policy header as a second layer.",
  check(project) {
    return scanLines(project, /dangerouslySetInnerHTML|\.innerHTML\s*=\s*[^"'`;]|\bv-html\s*=|\{@html\s/, {
      unless: /DOMPurify|sanitize/i,
      fileUnless: /DOMPurify|sanitize-html|isomorphic-dompurify/,
    });
  },
};

export const commandInjection: Rule = {
  id: "server.command-injection",
  title: "Shell command built from variables",
  severity: "high",
  category: "security",
  why: "Interpolating values into a shell command lets an attacker append their own commands (`; rm -rf /`).",
  fix: "Use `execFile`/`spawn` with an argument array (no shell), and validate inputs against an allow-list.",
  check(project) {
    return scanLines(project, /\b(exec|execSync|spawnSync|spawn)\s*\(\s*`[^`]*\$\{|os\.system\(\s*f["']|subprocess\.\w+\([^)]*shell\s*=\s*True/);
  },
};

export const jwtNoVerify: Rule = {
  id: "auth.jwt-not-verified",
  title: "JWT decoded without verifying its signature",
  severity: "high",
  category: "security",
  why: "`jwt.decode` and `jwtDecode` only read the token. Anyone can forge a token claiming to be any user or an admin.",
  fix: "Use `jwt.verify(token, secret)` / `jose.jwtVerify` on the server, or the auth provider's `getUser()` call, and reject unsigned (`alg: none`) tokens.",
  check(project) {
    return [
      ...scanLines(project, /\bjwt\.decode\(|\bjwtDecode\(|\bdecodeJwt\(/, {
        files: (f) => isCode(f) && !f.clientSide,
        fileUnless: /jwt\.verify|jwtVerify|verifyIdToken/,
      }),
      ...scanLines(project, /algorithms\s*:\s*\[[^\]]*["']none["']/i),
    ];
  },
};

export const hardcodedJwtSecret: Rule = {
  id: "auth.hardcoded-jwt-secret",
  title: "JWT signed with a hardcoded secret",
  severity: "high",
  category: "security",
  why: "Anyone who reads the code (or the bundle) can mint valid tokens for any user.",
  fix: "Load a long random secret from an env var (`openssl rand -base64 48`), rotate it, and invalidate existing sessions.",
  check(project) {
    return scanLines(project, /\b(jwt\.sign|sign)\([^)]*,\s*["'][^"']{3,}["']/);
  },
};

export const weakRandom: Rule = {
  id: "crypto.weak-random",
  title: "Math.random() used for a security value",
  severity: "medium",
  category: "security",
  why: "Math.random is predictable. Tokens, OTPs, invite codes or reset links built from it can be guessed.",
  fix: "Use `crypto.randomUUID()` or `crypto.getRandomValues()` (browser) / `crypto.randomBytes()` (Node).",
  check(project) {
    return scanLines(project, /Math\.random\(\)/, { unless: /^(?![\s\S]*(token|otp|code|secret|password|invite|reset|key|nonce|salt))/i });
  },
};

export const weakHash: Rule = {
  id: "crypto.weak-password-hash",
  title: "Weak hashing for passwords",
  severity: "high",
  category: "security",
  why: "MD5/SHA-1/plain SHA-256 are fast to brute-force. Leaked hashes become leaked passwords.",
  fix: "Let your auth provider store passwords, or use argon2id / bcrypt / scrypt with a per-user salt.",
  check(project) {
    return scanLines(project, /createHash\(\s*["'](md5|sha1)["']|hashlib\.(md5|sha1)\(|\bmd5\(/i);
  },
};

export const ssrf: Rule = {
  id: "server.ssrf",
  title: "Server fetches a URL supplied by the user",
  severity: "high",
  category: "security",
  why: "Fetching arbitrary user-supplied URLs lets attackers reach internal services and cloud metadata endpoints (stealing credentials) through your server.",
  fix: "Allow-list hostnames, block private/link-local IP ranges after DNS resolution, and disable redirects for these requests.",
  check(project) {
    return scanLines(project, /\b(fetch|axios\.get|axios|got|request|requests\.get|httpx\.get)\(\s*(req\.(body|query|params)|body|params|searchParams\.get\(|url\.searchParams\.get\(|request\.args)/, {
      files: (f) => isCode(f) && !f.clientSide,
    });
  },
};

export const openRedirect: Rule = {
  id: "web.open-redirect",
  title: "Redirect target taken from the URL",
  severity: "medium",
  category: "security",
  why: "Redirecting to `?next=` / `?redirect=` without validation lets phishers send your users to a look-alike login page through your domain. It also breaks OAuth flows in subtle ways.",
  fix: "Only accept relative paths (starting with a single `/`) or an allow-list of hosts.",
  check(project) {
    return scanLines(project, /(redirect|location\.href\s*=|window\.location\s*=|navigate)\(?\s*[^;]*(searchParams\.get\(\s*["'](next|redirect|returnTo|return_to|callbackUrl|url)["']\)|req\.query\.(next|redirect|returnTo|url))/);
  },
};

export const tokenInLocalStorage: Rule = {
  id: "auth.token-in-localstorage",
  title: "Auth token stored in localStorage",
  severity: "low",
  category: "security",
  why: "Any XSS bug can read localStorage and steal the session. HttpOnly cookies can't be read by scripts.",
  fix: "Prefer HttpOnly, Secure, SameSite cookies for sessions (e.g. `@supabase/ssr`), and add a strict Content-Security-Policy.",
  check(project) {
    return scanLines(project, /localStorage\.setItem\(\s*["'`][^"'`]*(token|jwt|session|auth)/i, { files: (f) => f.clientSide });
  },
};

export const sensitiveLogging: Rule = {
  id: "logging.sensitive-data",
  title: "Secrets or personal data written to logs",
  severity: "medium",
  category: "security",
  why: "Logs are copied to many places (hosting dashboards, log vendors, screenshots). Passwords, tokens and card data in logs are a breach waiting to happen.",
  fix: "Remove the log line or log a redacted identifier instead. Use a logger with redaction paths (pino `redact`).",
  check(project) {
    return scanLines(project, /(console\.(log|info|debug)|print|logger\.\w+)\([^)]*\b(password|passwd|secret|token|api_?key|apiKey|authorization|card_?number|cvv|ssn)\b/i);
  },
};

export const debugMode: Rule = {
  id: "config.debug-enabled",
  title: "Debug mode enabled",
  severity: "high",
  category: "security",
  why: "Debug mode exposes stack traces, settings and sometimes an interactive console to anyone who triggers an error.",
  fix: "Drive debug flags from an env var that defaults to off in production.",
  check(project) {
    return scanLines(project, /^\s*DEBUG\s*=\s*True\b|app\.run\([^)]*debug\s*=\s*True/, { files: (f) => f.path.endsWith(".py") });
  },
};

export const insecureHttp: Rule = {
  id: "web.insecure-http",
  title: "Plain http:// URL to a remote service",
  severity: "low",
  category: "security",
  why: "Unencrypted requests can be read and modified in transit, and browsers block them from HTTPS pages (mixed content).",
  fix: "Use https:// for every remote endpoint.",
  check(project) {
    return scanLines(project, /["'`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|www\.w3\.org|schemas\.|json-schema\.org|example\.)[a-z0-9.-]+\.[a-z]{2,}/i);
  },
};
