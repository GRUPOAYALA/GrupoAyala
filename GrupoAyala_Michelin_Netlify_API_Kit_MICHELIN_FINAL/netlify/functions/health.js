exports.handler = async () => ({
  statusCode: 200,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
    pragma: "no-cache",
    "access-control-allow-origin": "*"
  },
  body: JSON.stringify({
    status: "ok",
    service: "grupoayala-michelin-beta",
    timestamp: new Date().toISOString()
  })
});
