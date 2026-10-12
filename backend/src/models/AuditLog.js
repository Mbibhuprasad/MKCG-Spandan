const mongoose = require('mongoose');

const { Schema } = mongoose;

// Append-only record of sensitive administrative actions.
const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, default: '' },
    action: { type: String, required: true, maxlength: 60 },
    targetType: { type: String, default: '', maxlength: 40 },
    targetId: { type: String, default: '', maxlength: 40 },
    summary: { type: String, default: '', maxlength: 400 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
