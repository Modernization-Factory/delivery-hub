/** Audit trail: one document per mutating request, written by middleware. */
const { col } = require("./db");
function audit(action) {
  return async (req, _res, next) => {
    try {
      await col("auditLog").insertOne({
        at: new Date(),
        actorId: req.user.employee._id,
        actor: req.user.employee.name,
        role: req.user.role,
        action,
        method: req.method,
        path: req.originalUrl,
        body: req.method === "GET" ? undefined : req.body,
      });
    } catch (e) { /* audit failures must never block the request */ }
    next();
  };
}
module.exports = { audit };
