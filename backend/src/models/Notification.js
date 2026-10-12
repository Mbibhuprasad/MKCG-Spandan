const mongoose = require('mongoose');

const { Schema } = mongoose;

const NOTIFICATION_TYPES = [
  'CONTENT_APPROVED',
  'CONTENT_REJECTED',
  'CONTENT_REMOVED',
  'EVENT_PUBLISHED',
  'POLL_PUBLISHED',
  'EVENT_REMINDER',
  'NEW_COMMENT',
  'ACCOUNT_STATUS',
  'WELCOME',
];

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, default: '', maxlength: 500 },
    link: { type: String, default: '', maxlength: 300 },
    // When present, guarantees the same notification is never created twice.
    dedupeKey: { type: String, maxlength: 160 },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
notificationSchema.index(
  { user: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);
// Keep roughly six months of history.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
