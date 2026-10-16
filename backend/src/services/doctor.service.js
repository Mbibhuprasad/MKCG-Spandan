const User = require('../models/User');
const Media = require('../models/Media');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const Rsvp = require('../models/Rsvp');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const Poster = require('../models/Poster');
const { ACCOUNT_STATUS } = require('../config/constants');
const content = require('./content.service');
const { destroyMedia } = require('./media.service');
const { endAllSessions } = require('./session.service');
const { removeUserChatData } = require('./chat.service');

// Permanently deletes a doctor and everything they own.
//
// Deletion policy (documented in docs/DATABASE.md):
//   • the account, profile, sessions, notifications and uploaded media are removed;
//   • all content the doctor authored (posts, blogs, memories, events, polls,
//     comments) is removed together with its dependants;
//   • their likes, votes, RSVPs and reports are removed and counters corrected;
//   • their one-to-one conversations, chat messages and chat memberships are removed;
//   • their private batch posters are removed;
//   • the audit log keeps a minimal record (id + name) of the deletion.
//
// No multi-document transaction is used (not every MongoDB deployment supports
// them). Instead the account is locked first and each step is idempotent, so a
// run that fails part-way can simply be repeated.
async function deleteDoctorCascade(doctor) {
  const userId = doctor._id;

  if (doctor.status !== ACCOUNT_STATUS.SUSPENDED) {
    await User.updateOne({ _id: userId }, { $set: { status: ACCOUNT_STATUS.SUSPENDED } });
  }
  await endAllSessions(userId);

  for (const type of ['post', 'blog', 'memory', 'event', 'poll']) {
    const { Model, ownerField } = content.entry(type);
    const docs = await Model.find({ [ownerField]: userId });
    for (const doc of docs) await content.deleteContent(type, doc);
  }

  const comments = await Comment.find({ author: userId });
  for (const comment of comments) await content.deleteContent('comment', comment);

  const likes = await Like.find({ user: userId }).lean();
  for (const like of likes) {
    const removed = await Like.deleteOne({ _id: like._id });
    if (removed.deletedCount === 1) {
      await content
        .entry(like.targetType)
        .Model.updateOne({ _id: like.target, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } });
    }
  }

  const votes = await Vote.find({ user: userId }).lean();
  for (const vote of votes) {
    const removed = await Vote.deleteOne({ _id: vote._id });
    if (removed.deletedCount === 1) {
      await Poll.updateOne({ _id: vote.poll, voteCount: { $gt: 0 } }, { $inc: { voteCount: -1 } });
    }
  }

  await Rsvp.deleteMany({ user: userId });
  await Report.deleteMany({ reporter: userId });
  await Notification.deleteMany({ user: userId });
  await removeUserChatData(userId);
  await Poster.deleteMany({ owner: userId }); // poster photos are among the media destroyed below

  const media = await Media.find({ owner: userId }).select('_id').lean();
  await destroyMedia(media.map((m) => m._id));

  await User.deleteOne({ _id: userId });
}

module.exports = { deleteDoctorCascade };
