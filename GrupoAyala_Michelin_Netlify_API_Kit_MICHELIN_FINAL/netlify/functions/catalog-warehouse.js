const {
  json,
  validateHeaders,
  buildIssueTimestamp,
  buildDocumentNumber
} = require("./_lib/auth");

function detectDelimiter(headerLine) {
  const comma = headerLine.split(",").length;
  const semi = headerLine.split(";").length;
  return semi > comma ? ";" : ",";
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseWarehouses(text) {
  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map(normalizeHeader);
  const idxWarehouse = headers.indexOf("ALMACEN");
  const idxShipTo = headers.indexOf("SHIPTO") !== -1 ? headers.indexOf("SHIPTO") : headers.indexOf("SHIP_TO");

  if (idxWarehouse === -1) {
    throw new Error("CSV must contain ALMACEN column.");
  }

  const seen = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i].split(delimiter);
    const warehouse = String(row[idxWarehouse] ?? "").trim();
    if (!warehouse) continue;
    const shipTo = idxShipTo !== -1 ? String(row[idxShipTo] ?? "").trim() : "";
    const key = `${warehouse}__${shipTo}`;
    if (!seen.has(key)) {
      seen.set(key, {
        warehouse,
        ...(shipTo ? { shipTo } : {})
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.warehouse.localeCompare(b.warehouse));
}

async function fetchWarehouses(event) {
  const proto = event.headers?.["x-forwarded-proto"] || "https";
  const host = event.headers?.host;
  if (!host) throw new Error("Missing host header.");
  const url = `${proto}://${host}/inventarios.csv?ts=${Date.now()}`;
  const response = await fetch(url, {
    headers: { "cache-control": "no-store" }
  });
  if (!response.ok) {
    throw new Error(`Inventory CSV request failed with status ${response.status}.`);
  }
  return parseWarehouses(await response.text());
}

function buildBaseResponse() {
  return {
    ...buildIssueTimestamp(),
    documentID: "",
    documentNumber: buildDocumentNumber(),
    variant: 0
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return json(204, { ok: true });
  }

  if (event.httpMethod !== "GET") {
    return json(405, { error: "method_not_allowed", message: "Only GET is allowed." });
  }

  const auth = validateHeaders(event);
  if (!auth.ok) return auth.response;

  try {
    const warehouses = await fetchWarehouses(event);

    return json(200, {
      ...buildBaseResponse(),
      errorCode: { errorCode: 0 },
      errorHeader: null,
      totalLineItemNumber: warehouses.length,
      warehouses
    });
  } catch (error) {
    console.error("catalog-warehouse error", error);
    return json(500, {
      ...buildBaseResponse(),
      errorCode: { errorCode: 304 },
      errorHeader: "Request to ERP - System disconnected",
      totalLineItemNumber: 0,
      warehouses: []
    });
  }
};
