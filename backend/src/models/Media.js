const mongoose = require('mongoose');
const { MEDIA_PURPOSES } = require('../config/constants');

const { Schema } = mongoose;

// Metadata for an asset stored in Cloudinary. The binary never touches MongoDB
// or the server's disk.
const mediaSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: Object.keys(MEDIA_PURPOSES), required: true },
    publicId: { type: String, required: true, unique: true },
    resourceType: { type: String, enum: ['image', 'video'], required: true },
    deliveryType: { type: String, enum: ['upload', 'authenticated'], required: true },
    format: { type: String, default: '' },
    bytes: { type: Number, default: 0 },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },
    // Set once the upload is claimed by a post, blog, memory, event or profile.
    attachedTo: {
      kind: { type: String, enum: ['Post', 'Blog', 'Memory', 'Event', 'User'], default: null },
      item: { type: Schema.Types.ObjectId, default: null },
    },
    attachedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

mediaSchema.index({ 'attachedTo.item': 1 });
mediaSchema.index({ attachedAt: 1, createdAt: 1 });

module.exports = mongoose.model('Media', mediaSchema);
