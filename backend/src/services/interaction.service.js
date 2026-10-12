const Like = require('../models/Like');

// Which of these items has the viewer liked? One query per page of results.
async function likedSet(viewer, targetType, ids) {
  if (!viewer || !ids.length) return new Set();
  const likes = await Like.find({ user: viewer._id, targetType, target: { $in: ids } })
    .select('target')
    .lean();
  return new Set(likes.map((l) => String(l.target)));
}

async function hasLiked(viewer, targetType, id) {
  if (!viewer) return false;
  return Boolean(await Like.exists({ user: viewer._id, targetType, target: id }));
}

module.exports = { likedSet, hasLiked };
