const request = require("supertest");
const User = require("../src/models/User");
const Post = require("../src/models/Post");
const Blog = require("../src/models/Blog");
const Comment = require("../src/models/Comment");
const Memory = require("../src/models/Memory");
const AuditLog = require("../src/models/AuditLog");
const {
  publishPendingContent,
} = require("../src/services/legacyContent.service");
const {
  setupTestApp,
  registerDoctor,
  createAdmin,
  PNG,
  inFuture,
  LONG_BODY,
} = require("./helpers/harness");

const ctx = setupTestApp();

let admin;
let author;
let other;

const ids = (res) => res.body.data.map((item) => item.id);
const notificationsOf = async (client, type) =>
  (await client.get("/api/v1/notifications?limit=50")).body.data.filter(
    (n) => n.type === type,
  );

beforeAll(async () => {
  admin = await createAdmin(ctx.app);
  author = await registerDoctor(ctx.app, { name: "Dr Author One" });
  other = await registerDoctor(ctx.app, { name: "Dr Other Two" });
});

describe("there is no approval step", () => {
  test("the admin approval endpoint no longer exists, and doctors still cannot reach admin routes", async () => {
    const created = await author.post("/api/v1/posts", {
      body: "Nothing to approve here.",
    });
    const id = created.body.data.id;
    expect(
      (
        await admin.patch(`/api/v1/admin/moderation/posts/${id}`, {
          action: "approve",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await admin.patch(`/api/v1/admin/moderation/posts/${id}`, {
          action: "reject",
        })
      ).status,
    ).toBe(404);
    expect((await author.get("/api/v1/admin/moderation/posts")).status).toBe(
      403,
    );
    expect(
      (await author.delete(`/api/v1/admin/moderation/posts/${id}`)).status,
    ).toBe(403);
    await author.delete(`/api/v1/posts/${id}`);
  });
});

describe("posts", () => {
  let postId;

  test("a doctor’s post is published at once, whatever the request claims", async () => {
    const res = await author.post("/api/v1/posts", {
      body: "Looking forward to the silver jubilee reunion!",
      type: "REUNION_UPDATE",
      moderationStatus: "REJECTED",
      publishedAt: "2001-01-01T00:00:00.000Z",
      author: other.user.id,
      authorId: other.user.id,
      userId: other.user.id,
      role: "ADMIN",
      likeCount: 999,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.moderation.status).toBe("APPROVED");
    expect(res.body.data.author.id).toBe(author.user.id); // identity comes from the session
    expect(res.body.data.likeCount).toBe(0);
    postId = res.body.data.id;

    const stored = await Post.findById(postId);
    expect(stored.moderationStatus).toBe("APPROVED");
    expect(String(stored.author)).toBe(author.user.id);
    expect(Date.now() - stored.publishedAt.getTime()).toBeLessThan(60 * 1000);
  });

  test("it is immediately visible to other doctors and in the feed, without internal fields", async () => {
    expect(ids(await other.get("/api/v1/posts"))).toContain(postId);
    const seen = await other.get(`/api/v1/posts/${postId}`);
    expect(seen.status).toBe(200);
    expect(seen.body.data.moderation).toBeUndefined();
    expect((await request(ctx.app).get(`/api/v1/posts/${postId}`)).status).toBe(
      401,
    ); // the feed stays members-only

    expect(ids(await author.get("/api/v1/posts/mine"))).toContain(postId);
    expect(
      (await author.get("/api/v1/dashboard/summary")).body.data.submissions
        .post,
    ).toMatchObject({ APPROVED: 1, PENDING: 0 });
    expect(await notificationsOf(author, "CONTENT_APPROVED")).toHaveLength(0); // nothing was "approved"
  });

  test("editing keeps a post published", async () => {
    const edit = await author.patch(`/api/v1/posts/${postId}`, {
      body: "Edited text",
      moderationStatus: "PENDING",
    });
    expect(edit.status).toBe(200);
    expect(edit.body.data.moderation.status).toBe("APPROVED");
    expect(ids(await other.get("/api/v1/posts"))).toContain(postId);
    expect((await other.get(`/api/v1/posts/${postId}`)).body.data.body).toBe(
      "Edited text",
    );
  });

  test("doctors cannot modify or delete another doctor’s content", async () => {
    expect(
      (await other.patch(`/api/v1/posts/${postId}`, { body: "Hijacked" }))
        .status,
    ).toBe(403);
    expect((await other.delete(`/api/v1/posts/${postId}`)).status).toBe(403);
    expect((await Post.findById(postId)).body).toBe("Edited text");
  });

  test("an admin can delete any post, and it is audited", async () => {
    const queue = await admin.get("/api/v1/admin/moderation/posts");
    expect(ids(queue)).toContain(postId);

    const removed = await admin.delete(
      `/api/v1/admin/moderation/posts/${postId}`,
      { reason: "Duplicate" },
    );
    expect(removed.status).toBe(200);
    expect(await Post.findById(postId)).toBeNull();
    expect((await other.get(`/api/v1/posts/${postId}`)).status).toBe(404);

    const log = await AuditLog.findOne({
      action: "CONTENT_DELETED",
      targetId: postId,
    });
    expect(log).not.toBeNull();
    expect(log.actorName).toBe("Test Admin");
    expect(await notificationsOf(author, "CONTENT_REMOVED")).toHaveLength(1);
    expect(await AuditLog.countDocuments({ action: "CONTENT_APPROVED" })).toBe(
      0,
    );
  });

  test("admin-authored posts are published the same way", async () => {
    const res = await admin.post("/api/v1/posts", {
      body: "Welcome to the community, everyone.",
      type: "ANNOUNCEMENT",
    });
    expect(res.body.data.moderation.status).toBe("APPROVED");
    expect(ids(await other.get("/api/v1/posts"))).toContain(res.body.data.id);
  });
});

describe("blogs: one collection for the Blogs page and the author’s portfolio", () => {
  let blog;
  const payload = {
    title: "What twenty years of practice taught me",
    excerpt:
      "Reflections on the habits from our student years that still shape daily practice.",
    body: LONG_BODY,
    category: "Batch Stories",
    tags: ["Reunion", "reflection"],
  };

  test("a new blog is public immediately, without internal fields", async () => {
    const before = await Blog.countDocuments();
    const res = await author.post("/api/v1/blogs", {
      ...payload,
      moderationStatus: "PENDING",
      slug: "my-own-slug",
      author: other.user.id,
    });
    expect(res.status).toBe(201);
    blog = res.body.data;
    expect(blog.moderation.status).toBe("APPROVED");
    expect(blog.author.id).toBe(author.user.id);
    expect(blog.slug).not.toBe("my-own-slug");
    expect(blog.slug).toMatch(
      /^what-twenty-years-of-practice-taught-me-[a-f0-9]{6}$/,
    );
    expect(blog.tags).toEqual(["reunion", "reflection"]);
    expect(await Blog.countDocuments()).toBe(before + 1); // exactly one record

    const publicList = await request(ctx.app).get("/api/v1/blogs");
    expect(ids(publicList)).toContain(blog.id);
    expect(
      publicList.body.data.find((b) => b.id === blog.id).bodyHtml,
    ).toBeUndefined();

    const detail = await request(ctx.app).get(
      `/api/v1/blogs/slug/${blog.slug}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.data.bodyHtml).toContain("<p>");
    expect(detail.body.data.bodyMarkdown).toBeUndefined();
    expect(detail.body.data.moderation).toBeUndefined();
    expect(detail.body.data.publishedAt).toBeTruthy();

    expect(
      ids(
        await request(ctx.app).get(
          "/api/v1/blogs?category=Batch%20Stories&tag=reunion",
        ),
      ),
    ).toContain(blog.id);
    const taxonomy = await request(ctx.app).get("/api/v1/blogs/taxonomy");
    expect(
      taxonomy.body.data.categories.find((c) => c.name === "Batch Stories")
        .count,
    ).toBe(1);
  });

  test("the same record appears on the Blogs page, on the author’s portfolio and in their own list", async () => {
    const elsewhere = await other.post("/api/v1/blogs", {
      ...payload,
      title: "A blog by somebody else entirely",
    });

    const community = ids(await request(ctx.app).get("/api/v1/blogs"));
    expect(community.filter((id) => id === blog.id)).toHaveLength(1); // listed once, never duplicated
    expect(community).toContain(elsewhere.body.data.id);

    const portfolio = await request(ctx.app).get(
      `/api/v1/blogs?author=${author.user.id}`,
    );
    expect(ids(portfolio)).toEqual([blog.id]);
    expect(ids(await author.get("/api/v1/blogs/mine"))).toEqual([blog.id]);

    expect(await Blog.countDocuments({ author: author.user.id })).toBe(1);
    expect(
      (await request(ctx.app).get("/api/v1/blogs?author=not-an-id")).status,
    ).toBe(400);
    await other.delete(`/api/v1/blogs/${elsewhere.body.data.id}`);
  });

  test("editing keeps the slug stable and the blog public", async () => {
    const edit = await author.patch(`/api/v1/blogs/${blog.id}`, {
      title: "A completely different headline",
    });
    expect(edit.status).toBe(200);
    expect(edit.body.data.slug).toBe(blog.slug);
    expect(edit.body.data.moderation.status).toBe("APPROVED");
    expect(
      (await request(ctx.app).get(`/api/v1/blogs/slug/${blog.slug}`)).body.data
        .title,
    ).toBe("A completely different headline");
    expect(
      (
        await other.patch(`/api/v1/blogs/${blog.id}`, {
          title: "Not my blog at all",
        })
      ).status,
    ).toBe(403);
    expect((await other.delete(`/api/v1/blogs/${blog.id}`)).status).toBe(403);
  });

  test("admins can delete any blog", async () => {
    expect(
      (await admin.delete(`/api/v1/admin/moderation/blogs/${blog.id}`)).status,
    ).toBe(200);
    expect(
      (await request(ctx.app).get(`/api/v1/blogs/slug/${blog.slug}`)).status,
    ).toBe(404);
    expect(
      ids(await request(ctx.app).get(`/api/v1/blogs?author=${author.user.id}`)),
    ).toEqual([]);
  });
});

describe("comments", () => {
  let postId;
  let commentId;

  beforeAll(async () => {
    const created = await author.post("/api/v1/posts", {
      body: "A post to discuss",
    });
    postId = created.body.data.id;
  });

  test("a comment appears in the thread at once and is counted exactly once", async () => {
    const res = await other.post("/api/v1/comments", {
      targetType: "post",
      targetId: postId,
      body: "Count me in for the reunion!",
      moderationStatus: "PENDING",
      author: author.user.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.moderation.status).toBe("APPROVED");
    expect(res.body.data.author.id).toBe(other.user.id);
    commentId = res.body.data.id;

    expect(
      ids(
        await author.get(`/api/v1/comments?targetType=post&targetId=${postId}`),
      ),
    ).toContain(commentId);
    expect(
      (await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount,
    ).toBe(1);
    expect(await notificationsOf(author, "NEW_COMMENT")).toHaveLength(1);
    expect(ids(await admin.get("/api/v1/admin/moderation/comments"))).toContain(
      commentId,
    );
  });

  test("editing keeps the comment in the thread", async () => {
    const edited = await other.patch(`/api/v1/comments/${commentId}`, {
      body: "Count me in — with family!",
    });
    expect(edited.body.data.moderation.status).toBe("APPROVED");
    expect(
      (await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount,
    ).toBe(1);
    const thread = await author.get(
      `/api/v1/comments?targetType=post&targetId=${postId}`,
    );
    expect(thread.body.data.find((c) => c.id === commentId).body).toBe(
      "Count me in — with family!",
    );
  });

  test("only the commenter or an admin can remove a comment", async () => {
    expect((await author.delete(`/api/v1/comments/${commentId}`)).status).toBe(
      403,
    );
    expect(
      (
        await author.patch(`/api/v1/comments/${commentId}`, {
          body: "Tampered",
        })
      ).status,
    ).toBe(403);

    expect(
      (await admin.delete(`/api/v1/admin/moderation/comments/${commentId}`))
        .status,
    ).toBe(200);
    expect(await Comment.findById(commentId)).toBeNull();
    expect(
      (await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount,
    ).toBe(0);

    const own = await other.post("/api/v1/comments", {
      targetType: "post",
      targetId: postId,
      body: "One more thought.",
    });
    expect(
      (await other.delete(`/api/v1/comments/${own.body.data.id}`)).status,
    ).toBe(200);
    expect(
      (await author.get(`/api/v1/posts/${postId}`)).body.data.commentCount,
    ).toBe(0);
  });
});

describe("memories: community Memories and the profile Gallery are separate lists of one collection", () => {
  let memoryId;
  let mediaId;
  let privateId;
  let privateMediaId;
  const gallery = (client, ownerId = author.user.id) =>
    client.get(`/api/v1/memories?owner=${ownerId}`);

  test("a new memory is available to members immediately; visitors get nothing", async () => {
    const upload = await author.upload("memory", PNG);
    expect(upload.status).toBe(201);
    mediaId = upload.body.data.id;

    const res = await author.post("/api/v1/memories", {
      title: "Convocation day",
      caption: "The whole batch on stage.",
      mediaIds: [mediaId],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.moderation.status).toBe("APPROVED");
    expect(res.body.data.showInCommunity).toBe(true);
    memoryId = res.body.data.id;

    const list = await other.get("/api/v1/memories");
    expect(ids(list)).toContain(memoryId);
    expect(
      list.body.data.find((m) => m.id === memoryId).media[0].url,
    ).toContain("/authenticated/s--"); // signed delivery of a private asset

    const download = await other.get(
      `/api/v1/memories/${memoryId}/media/${mediaId}/download`,
    );
    expect(download.status).toBe(200);
    expect(download.body.data.url).toMatch(/expires_at=\d+/);
    expect(download.body.data.expiresInSeconds).toBeLessThanOrEqual(300);

    expect((await request(ctx.app).get("/api/v1/memories")).status).toBe(401);
    expect(
      (await request(ctx.app).get(`/api/v1/memories?owner=${author.user.id}`))
        .status,
    ).toBe(401);
    expect(
      (
        await request(ctx.app).get(
          `/api/v1/memories/${memoryId}/media/${mediaId}/download`,
        )
      ).status,
    ).toBe(401);
    // A media id that does not belong to this memory is refused.
    expect(
      (
        await other.get(
          `/api/v1/memories/${memoryId}/media/64b7f0f0f0f0f0f0f0f0f0f0/download`,
        )
      ).status,
    ).toBe(404);
  });

  test("a community memory is not put in its owner's profile gallery", async () => {
    expect(ids(await gallery(other))).toEqual([]);
    expect(ids(await gallery(author))).toEqual([]);
    expect(
      ids(await other.get("/api/v1/memories")).filter((id) => id === memoryId),
    ).toHaveLength(1);
    expect(ids(await author.get("/api/v1/memories/mine"))).toEqual([memoryId]);
    expect(await Memory.countDocuments({ owner: author.user.id })).toBe(1);
    expect(ids(await gallery(other, other.user.id))).toEqual([]); // each gallery holds its owner's items only
  });

  test("a gallery item is shown on its owner's profile only, never in the community section", async () => {
    const upload = await author.upload("memory", PNG);
    privateMediaId = upload.body.data.id;
    const res = await author.post("/api/v1/memories", {
      title: "Clinic opening",
      mediaIds: [privateMediaId],
      showInCommunity: false,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.showInCommunity).toBe(false);
    privateId = res.body.data.id;

    expect(ids(await other.get("/api/v1/memories"))).not.toContain(privateId);
    expect(ids(await gallery(other))).toEqual([privateId]);
    expect(ids(await gallery(other, other.user.id))).toEqual([]); // the right photos on the right profile
    expect((await other.get(`/api/v1/memories/${privateId}`)).status).toBe(200);
    expect(await Memory.countDocuments({ owner: author.user.id })).toBe(2); // the community memory is untouched
  });

  test("gallery items of a doctor who hides their gallery or profile are not served to other members", async () => {
    const path = `/api/v1/memories/${privateId}/media/${privateMediaId}/download`;

    await author.patch("/api/v1/doctors/me", {
      visibility: { sections: { gallery: false } },
    });
    expect(ids(await gallery(other))).toEqual([]);
    expect((await other.get(`/api/v1/memories/${privateId}`)).status).toBe(404);
    expect((await other.get(path)).status).toBe(404);
    // The owner and administrators still see everything.
    expect(ids(await gallery(author))).toEqual([privateId]);
    expect(ids(await gallery(admin))).toEqual([privateId]);
    expect((await author.get(path)).status).toBe(200);

    await author.patch("/api/v1/doctors/me", {
      visibility: { directory: false, sections: { gallery: true } },
    });
    expect(ids(await gallery(other))).toEqual([]);
    expect((await other.get(path)).status).toBe(404);
    // Hiding a gallery never hides the owner's community memories.
    expect(ids(await other.get("/api/v1/memories"))).toContain(memoryId);

    await author.patch("/api/v1/doctors/me", {
      visibility: { directory: true },
    });
    expect((await other.get(path)).status).toBe(200);
    expect(ids(await gallery(other))).toEqual([privateId]);
  });

  test("the owner can change where an item is shown; other doctors cannot touch it", async () => {
    expect(
      (
        await other.patch(`/api/v1/memories/${privateId}`, {
          showInCommunity: true,
        })
      ).status,
    ).toBe(403);
    expect((await other.delete(`/api/v1/memories/${privateId}`)).status).toBe(
      403,
    );

    // Nobody can add to another doctor's gallery: a new item always belongs to its uploader.
    const foreignUpload = await other.upload("memory", PNG);
    const foreign = await other.post("/api/v1/memories", {
      title: "Not the author's photo",
      mediaIds: [foreignUpload.body.data.id],
      showInCommunity: false,
      owner: author.user.id,
    });
    expect(foreign.status).toBe(201);
    expect(foreign.body.data.owner.id).toBe(other.user.id);
    expect(ids(await gallery(other))).toEqual([privateId]);
    expect(ids(await gallery(author, other.user.id))).toEqual([
      foreign.body.data.id,
    ]);
    expect(
      (await other.delete(`/api/v1/memories/${foreign.body.data.id}`)).status,
    ).toBe(200);

    const shown = await author.patch(`/api/v1/memories/${privateId}`, {
      showInCommunity: true,
    });
    expect(shown.body.data.showInCommunity).toBe(true);
    expect(ids(await other.get("/api/v1/memories"))).toContain(privateId);
    expect(ids(await gallery(other))).toEqual([]); // moved, not duplicated
    expect(await Memory.countDocuments({ owner: author.user.id })).toBe(2); // still two records, no copies
  });

  test("admins can delete any memory", async () => {
    expect(
      (await admin.delete(`/api/v1/admin/moderation/memories/${memoryId}`))
        .status,
    ).toBe(200);
    expect((await author.get(`/api/v1/memories/${memoryId}`)).status).toBe(404);
    const community = ids(await other.get("/api/v1/memories"));
    expect(community).not.toContain(memoryId);
    expect(community).toContain(privateId);
  });
});

describe("events and visit plans", () => {
  let eventId;
  let visitId;

  const eventPayload = () => ({
    title: "Silver jubilee reunion dinner",
    description: "An evening for the whole batch with families.",
    eventType: "REUNION",
    venue: "Hotel Sea View, Private Hall",
    city: "Gopalpur",
    startsAt: inFuture(30),
    endsAt: inFuture(31),
    budgetNote: "About 2,500 per person",
    showOnPublicSite: true,
  });

  test("events and visit plans are published immediately and members are notified once", async () => {
    const event = await author.post("/api/v1/events", eventPayload());
    expect(event.status).toBe(201);
    expect(event.body.data.moderation.status).toBe("APPROVED");
    eventId = event.body.data.id;

    const visit = await author.post("/api/v1/events", {
      title: "Visiting Bengaluru in December",
      description:
        "In town for a conference — happy to meet batchmates for coffee.",
      eventType: "VISIT_PLAN",
      city: "Bengaluru",
      startsAt: inFuture(40),
    });
    expect(visit.status).toBe(201);
    visitId = visit.body.data.id;

    expect(ids(await other.get("/api/v1/events"))).toEqual([eventId, visitId]);
    expect(ids(await other.get("/api/v1/events?type=VISIT_PLAN"))).toEqual([
      visitId,
    ]);
    expect((await other.get(`/api/v1/events/${eventId}`)).body.data.venue).toBe(
      "Hotel Sea View, Private Hall",
    );
    expect(ids(await author.get("/api/v1/events/mine"))).toEqual(
      expect.arrayContaining([eventId, visitId]),
    );

    expect(await notificationsOf(other, "EVENT_PUBLISHED")).toHaveLength(2);
    expect(await notificationsOf(author, "EVENT_PUBLISHED")).toHaveLength(0); // not the organiser

    // Editing does not announce it a second time.
    await author.patch(`/api/v1/events/${eventId}`, {
      budgetNote: "About 3,000 per person",
    });
    expect(await notificationsOf(other, "EVENT_PUBLISHED")).toHaveLength(2);
    expect(ids(await other.get("/api/v1/events"))).toContain(eventId);
  });

  test("RSVPs are open straight away", async () => {
    const rsvp = await other.put(`/api/v1/events/${eventId}/rsvp`, {
      status: "GOING",
    });
    expect(rsvp.status).toBe(200);
    expect(rsvp.body.data.rsvp.going).toBe(1);
  });

  test("only a summary is public, and only for events that opted in", async () => {
    const pub = await request(ctx.app).get("/api/v1/events/public");
    expect(pub.body.data).toHaveLength(1); // the visit plan did not opt in
    expect(Object.keys(pub.body.data[0]).sort()).toEqual([
      "city",
      "endsAt",
      "eventType",
      "id",
      "startsAt",
      "title",
    ]);
    expect(JSON.stringify(pub.body)).not.toContain("Hotel Sea View");
    expect((await request(ctx.app).get("/api/v1/events")).status).toBe(401);
  });

  test("validates dates and blocks edits by other doctors", async () => {
    const past = await author.post("/api/v1/events", {
      ...eventPayload(),
      startsAt: inFuture(-2),
      endsAt: inFuture(-1),
    });
    expect(past.status).toBe(400);
    const reversed = await author.post("/api/v1/events", {
      ...eventPayload(),
      startsAt: inFuture(10),
      endsAt: inFuture(9),
    });
    expect(reversed.status).toBe(400);
    expect(
      (
        await other.patch(`/api/v1/events/${eventId}`, {
          title: "Changed by someone else",
        })
      ).status,
    ).toBe(403);
    expect((await other.delete(`/api/v1/events/${eventId}`)).status).toBe(403);
  });

  test("admins see events and visit plans in separate lists and can delete either", async () => {
    expect(ids(await admin.get("/api/v1/admin/moderation/events"))).toEqual([
      eventId,
    ]);
    expect(
      ids(await admin.get("/api/v1/admin/moderation/visit-plans")),
    ).toEqual([visitId]);
    // An item cannot be deleted through the wrong list.
    expect(
      (await admin.delete(`/api/v1/admin/moderation/events/${visitId}`)).status,
    ).toBe(404);

    const stats = await admin.get("/api/v1/admin/stats");
    expect(stats.body.data.content).toMatchObject({
      events: 1,
      "visit-plans": 1,
    });
    expect(stats.body.data.pending).toBeUndefined();

    expect(
      (await admin.delete(`/api/v1/admin/moderation/visit-plans/${visitId}`))
        .status,
    ).toBe(200);
    expect(
      (await admin.delete(`/api/v1/admin/moderation/events/${eventId}`)).status,
    ).toBe(200);
    expect(ids(await other.get("/api/v1/events"))).toEqual([]);
  });
});

describe("polls", () => {
  let pollId;
  let optionId;

  test("a poll is open to members immediately", async () => {
    const res = await author.post("/api/v1/polls", {
      question: "Which month suits you for the reunion?",
      options: ["December", "January", "February"],
      endsAt: inFuture(14),
      moderationStatus: "PENDING",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.moderation.status).toBe("APPROVED");
    pollId = res.body.data.id;

    expect(ids(await other.get("/api/v1/polls"))).toContain(pollId);
    expect((await other.get(`/api/v1/polls/${pollId}`)).status).toBe(200);
    expect(await notificationsOf(other, "POLL_PUBLISHED")).toHaveLength(1);
    expect(ids(await admin.get("/api/v1/admin/moderation/polls"))).toContain(
      pollId,
    );
  });

  test("the author may edit until the first vote; then the options are locked", async () => {
    const edit = await author.patch(`/api/v1/polls/${pollId}`, {
      options: ["December", "January"],
    });
    expect(edit.status).toBe(200);
    expect(edit.body.data.options).toHaveLength(2);
    optionId = edit.body.data.options[0].id;
    expect(
      (
        await other.patch(`/api/v1/polls/${pollId}`, {
          question: "Changed by another doctor?",
        })
      ).status,
    ).toBe(403);

    expect(
      (
        await other.post(`/api/v1/polls/${pollId}/vote`, {
          optionIds: [optionId],
        })
      ).status,
    ).toBe(201);

    const locked = await author.patch(`/api/v1/polls/${pollId}`, {
      options: ["March", "April"],
    });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe("POLL_LOCKED");
  });

  test("admins can delete any poll", async () => {
    expect((await other.delete(`/api/v1/polls/${pollId}`)).status).toBe(403);
    expect(
      (await admin.delete(`/api/v1/admin/moderation/polls/${pollId}`)).status,
    ).toBe(200);
    expect((await other.get(`/api/v1/polls/${pollId}`)).status).toBe(404);
  });
});

// Records written while content still needed approval. They are created
// directly in the database, because the API can no longer produce them.
describe("content left over from the former approval workflow", () => {
  let legacyAuthor;
  let suspended;
  let pendingPost;
  let rejectedPost;
  let suspendedPost;
  let publishedPost;
  let pendingComment;
  let orphanComment;
  const submittedAt = new Date("2026-03-01T10:00:00.000Z");
  const legacy = (fields) => ({
    moderationStatus: "PENDING",
    submittedAt,
    publishedAt: null,
    ...fields,
  });

  beforeAll(async () => {
    legacyAuthor = await registerDoctor(ctx.app, { name: "Dr Legacy Author" });
    suspended = await registerDoctor(ctx.app, { name: "Dr Suspended Then" });

    pendingPost = await Post.create(
      legacy({
        author: legacyAuthor.user.id,
        body: "Waiting for a review that will never come",
      }),
    );
    rejectedPost = await Post.create(
      legacy({
        author: legacyAuthor.user.id,
        body: "Refused by an administrator",
        moderationStatus: "REJECTED",
        rejectionReason: "Promotional",
      }),
    );
    suspendedPost = await Post.create(
      legacy({
        author: suspended.user.id,
        body: "Pending post of a suspended account",
      }),
    );
    publishedPost = await author
      .post("/api/v1/posts", { body: "A normal, published post" })
      .then((r) => r.body.data);

    pendingComment = await Comment.create(
      legacy({
        author: legacyAuthor.user.id,
        targetType: "post",
        target: publishedPost.id,
        body: "A comment that was awaiting review",
      }),
    );
    orphanComment = await Comment.create(
      legacy({
        author: legacyAuthor.user.id,
        targetType: "post",
        target: rejectedPost._id,
        body: "A comment on a refused post",
      }),
    );

    await User.updateOne(
      { _id: suspended.user.id },
      { $set: { status: "SUSPENDED" } },
    );
  });

  test("old pending and rejected records still load, and stay hidden from other members", async () => {
    expect(ids(await other.get("/api/v1/posts"))).not.toContain(
      String(pendingPost._id),
    );
    expect((await other.get(`/api/v1/posts/${pendingPost._id}`)).status).toBe(
      404,
    );
    expect((await other.get(`/api/v1/posts/${rejectedPost._id}`)).status).toBe(
      404,
    );
    expect(
      (await legacyAuthor.get(`/api/v1/posts/${pendingPost._id}`)).body.data
        .moderation.status,
    ).toBe("PENDING");
    expect(ids(await legacyAuthor.get("/api/v1/posts/mine"))).toEqual(
      expect.arrayContaining([
        String(pendingPost._id),
        String(rejectedPost._id),
      ]),
    );
    // Interactions are refused on something that is not published.
    expect(
      (await legacyAuthor.put(`/api/v1/likes/post/${pendingPost._id}`)).status,
    ).toBe(409);

    const hiddenOnly = await admin.get(
      "/api/v1/admin/moderation/posts?status=PENDING",
    );
    expect(ids(hiddenOnly)).toEqual(
      expect.arrayContaining([
        String(pendingPost._id),
        String(suspendedPost._id),
      ]),
    );
    expect(
      (await admin.get("/api/v1/admin/stats")).body.data.hiddenLegacyItems,
    ).toBeGreaterThanOrEqual(5);
  });

  test("a dry run reports what would be published and changes nothing", async () => {
    const report = await publishPendingContent();
    expect(report.post).toMatchObject({
      pending: 2,
      published: 1,
      skippedOwner: 1,
    });
    expect(report.comment).toMatchObject({
      pending: 2,
      published: 1,
      skippedTarget: 1,
    });
    expect((await Post.findById(pendingPost._id)).moderationStatus).toBe(
      "PENDING",
    );
    expect((await Comment.findById(pendingComment._id)).moderationStatus).toBe(
      "PENDING",
    );
    expect((await Post.findById(publishedPost.id)).commentCount).toBe(0);
  });

  test("applying it publishes legitimate pending content and nothing else", async () => {
    const report = await publishPendingContent({ apply: true });
    expect(report.post.published).toBe(1);
    expect(report.comment.published).toBe(1);

    const post = await Post.findById(pendingPost._id);
    expect(post.moderationStatus).toBe("APPROVED");
    expect(post.publishedAt.toISOString()).toBe(submittedAt.toISOString()); // keeps its place in the timeline
    expect(ids(await other.get("/api/v1/posts"))).toContain(
      String(pendingPost._id),
    );

    // The comment joined its thread and was counted once.
    expect((await Comment.findById(pendingComment._id)).moderationStatus).toBe(
      "APPROVED",
    );
    expect((await Post.findById(publishedPost.id)).commentCount).toBe(1);

    // Not exposed: explicitly rejected content, a suspended account's content, a comment on unpublished content.
    expect((await Post.findById(rejectedPost._id)).moderationStatus).toBe(
      "REJECTED",
    );
    expect((await Post.findById(suspendedPost._id)).moderationStatus).toBe(
      "PENDING",
    );
    expect((await Comment.findById(orphanComment._id)).moderationStatus).toBe(
      "PENDING",
    );
    expect((await other.get(`/api/v1/posts/${rejectedPost._id}`)).status).toBe(
      404,
    );
    expect((await other.get(`/api/v1/posts/${suspendedPost._id}`)).status).toBe(
      404,
    );

    // No approval notifications are sent for the clean-up.
    expect(
      await notificationsOf(legacyAuthor, "CONTENT_APPROVED"),
    ).toHaveLength(0);
  });

  test("running it again is harmless", async () => {
    const report = await publishPendingContent({ apply: true });
    expect(report.post).toMatchObject({
      pending: 1,
      published: 0,
      skippedOwner: 1,
    });
    expect(report.comment).toMatchObject({
      pending: 1,
      published: 0,
      skippedTarget: 1,
    });
    expect((await Post.findById(publishedPost.id)).commentCount).toBe(1);
  });

  test("an owner who edits a still-hidden item publishes it; admins can delete hidden items", async () => {
    const edited = await legacyAuthor.patch(
      `/api/v1/posts/${rejectedPost._id}`,
      { body: "Rewritten without the promotion" },
    );
    expect(edited.status).toBe(200);
    expect(edited.body.data.moderation).toMatchObject({
      status: "APPROVED",
      rejectionReason: "",
    });
    expect(ids(await other.get("/api/v1/posts"))).toContain(
      String(rejectedPost._id),
    );

    // The comment on it was hidden too; editing it publishes it and counts it once.
    const comment = await legacyAuthor.patch(
      `/api/v1/comments/${orphanComment._id}`,
      { body: "A comment, now on a published post" },
    );
    expect(comment.body.data.moderation.status).toBe("APPROVED");
    expect((await Post.findById(rejectedPost._id)).commentCount).toBe(1);

    expect(
      (
        await admin.delete(
          `/api/v1/admin/moderation/posts/${suspendedPost._id}`,
        )
      ).status,
    ).toBe(200);
    expect(await Post.findById(suspendedPost._id)).toBeNull();
  });
});
