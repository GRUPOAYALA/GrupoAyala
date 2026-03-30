function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      pragma: "no-cache",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "content-type,authorization,apikey,client-id",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function getHeader(event, name) {
  const headers = event.headers || {};
  const lower = name.toLowerCase();
  return headers[lower] || headers[name] || headers[name.toUpperCase()] || "";
}

function validateHeaders(event) {
  const authorization = getHeader(event, "authorization").trim();
  const apiKey = getHeader(event, "apikey").trim();
  const clientId = getHeader(event, "client-id").trim();

  if (!authorization || !apiKey || !clientId) {
    return {
      ok: false,
      response: json(401, {
        error: "missing_headers",
        message: "Required headers: Authorization, apikey, client-id"
      })
    };
  }

  if (!authorization.startsWith("Bearer ")) {
    return {
      ok: false,
      response: json(401, {
        error: "invalid_authorization_format",
        message: "Authorization header must use Bearer <access_token>"
      })
    };
  }

  if (process.env.MICHELIN_API_KEY && apiKey !== process.env.MICHELIN_API_KEY) {
    return {
      ok: false,
      response: json(403, {
        error: "invalid_apikey",
        message: "Invalid apikey"
      })
    };
  }

  if (process.env.MICHELIN_CLIENT_ID && clientId !== process.env.MICHELIN_CLIENT_ID) {
    return {
      ok: false,
      response: json(403, {
        error: "invalid_client_id",
        message: "Invalid client-id"
      })
    };
  }

  const bearerToken = authorization.slice("Bearer ".length).trim();
  if (!bearerToken) {
    return {
      ok: false,
      response: json(401, {
        error: "empty_bearer_token",
        message: "Bearer token is empty"
      })
    };
  }

  if (process.env.MICHELIN_BEARER_TOKEN && bearerToken !== process.env.MICHELIN_BEARER_TOKEN) {
    return {
      ok: false,
      response: json(403, {
        error: "invalid_token",
        message: "Invalid bearer token"
      })
    };
  }

  return {
    ok: true,
    authorization,
    apiKey,
    clientId,
    bearerToken
  };
}

function buildIssueTimestamp() {
  const now = new Date();
  return {
    issueDate: now.toISOString().slice(0, 10),
    issueTime: now.toTimeString().slice(0, 8)
  };
}

function buildDocumentNumber(prefix = "GA-MICH") {
  const now = new Date();
  const compactDate = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${compactDate}-${rand}`;
}

module.exports = {
  json,
  getHeader,
  validateHeaders,
  buildIssueTimestamp,
  buildDocumentNumber
};
