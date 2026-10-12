const mongoose = require('mongoose');
const { REPORT_REASONS, REPORT_STATUS } = require('../config/constants');

const { Schema } = mongoose;

const REPORT_TARGETS = ['post', 'blog', 'comment', 'memory', 'event', 'poll'];

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: REPORT_TARGETS, required: true },
    target: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: REPORT_STATUS, default: 'OPEN' },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A doctor can report a given item once.
reportSchema.index({ reporter: 1, targetType: 1, target: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, target: 1 });

module.exports = mongoose.model('Report', reportSchema);
module.exports.REPORT_TARGETS = REPORT_TARGETS;
