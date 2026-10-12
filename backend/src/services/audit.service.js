const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

// Records a sensitive administrative action. Metadata must stay small and must
// never contain secrets, password material or full content bodies.
async function audit(actor, { action, targetType = '', targetId = '', summary = '', metadata = {} }) {
  try {
    await AuditLog.create({
      actor: actor ? actor._id : null,
      actorName: actor ? actor.name : 'system',
      action,
      targetType,
      targetId: targetId ? String(targetId) : '',
      summary: String(summary).slice(0, 400),
      metadata,
    });
  } catch (err) {
    logger.error('Failed to write audit log entry:', err.message);
  }
}

module.exports = { audit };
