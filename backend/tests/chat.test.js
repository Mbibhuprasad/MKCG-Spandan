// Chat: WhatsApp contact rules, group and one-to-one conversations over REST,
// and real-time delivery over Socket.IO with a real socket client.
const http = require("http");
const request = require("supertest");
const { io: connect } = require("socket.io-client");
const {
  setupTestApp,
  doctorPayload,
  createAdmin,
} = require("./helpers/harness");

const ctx = setupTestApp();
const API = "/api/v1";

// A mobile-style client: bearer token, no cookies, no Origin header.
async function mobileDoctor(overrides = {}) {
  const payload = doctorPayload(overrides);
  const res = await request(ctx.app)
    .post(`${API}/auth/register`)
    .set("X-Client-Type", "mobile")
    .send(payload);
  if (res.status !== 201)
    throw new Error(
      `Registration failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  const { token, user } = res.body.data;
  const auth = (req) => req.set("Authorization", `Bearer ${token}`);
  return {
    token,
    user,
    payload,
    get: (url) => auth(request(ctx.app).get(`${API}${url}`)),
    post: (url, body) => auth(request(ctx.app).post(`${API}${url}`)).send(body),
    patch: (url, body) =>
      auth(request(ctx.app).patch(`${API}${url}`)).send(body),
    put: (url, body) => auth(request(ctx.app).put(`${API}${url}`)).send(body),
  };
}

// A doctor who has completed the WhatsApp step and may use one-to-one chat.
async function chatReadyDoctor(overrides) {
  const doctor = await mobileDoctor(overrides);
  const res = await doctor.patch("/doctors/me", {
    whatsapp: { sameAsPhone: true },
  });
  expect(res.status).toBe(200);
  return doctor;
}

const communityOf = async (doctor) => {
  const res = await doctor.get("/chat/conversations?type=GROUP");
  expect(res.status).toBe(200);
  return res.body.data.find((c) => c.isCommunity);
};

describe("WhatsApp number", () => {
  test("is validated, normalised and never stored twice", async () => {
    const doctor = await mobileDoctor();
    expect(doctor.user.whatsapp).toEqual({ number: "", sameAsPhone: false });

    const bad = await doctor.patch("/doctors/me", {
      whatsapp: { number: "call me maybe" },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details["whatsapp.number"]).toBeDefined();

    const own = await doctor.patch("/doctors/me", {
      whatsapp: { number: "098765 43210" },
    });
    expect(own.body.data.whatsapp).toEqual({
      number: "+919876543210",
      sameAsPhone: false,
    });

    // Entering the registered phone number is recorded as "same as phone".
    const same = await doctor.patch("/doctors/me", {
      whatsapp: { number: doctor.payload.phone },
    });
    expect(same.body.data.whatsapp).toEqual({
      number: doctor.user.phone,
      sameAsPhone: true,
    });
    const User = require("../src/models/User");
    const stored = await User.findById(doctor.user.id);
    expect(stored.whatsapp.number).toBe("");
    expect(stored.whatsapp.sameAsPhone).toBe(true);

    const cleared = await doctor.patch("/doctors/me", {
      whatsapp: { number: "" },
    });
    expect(cleared.body.data.whatsapp).toEqual({
      number: "",
      sameAsPhone: false,
    });
  });

  test("is shown to other members only while the doctor allows it", async () => {
    const owner = await mobileDoctor();
    const viewer = await mobileDoctor();
    await owner.patch("/doctors/me", { whatsapp: { number: "+447700900123" } });

    const visible = await viewer.get(`/doctors/${owner.user.id}`);
    expect(visible.body.data.contact).toEqual({ whatsapp: "+447700900123" });
    // The registered phone number stays private: it is a separate setting.
    expect(JSON.stringify(visible.body.data)).not.toContain(owner.user.phone);

    const saved = await owner.patch("/doctors/me", {
      visibility: { showWhatsapp: false },
    });
    expect(saved.body.data.visibility.showWhatsapp).toBe(false);
    const hidden = await viewer.get(`/doctors/${owner.user.id}`);
    expect(hidden.body.data.contact).toEqual({});

    const mine = await owner.get(`/doctors/${owner.user.id}`);
    expect(mine.body.data.contact.whatsapp).toBe("+447700900123");
  });
});

describe("group chat", () => {
  test("chat requires a signed-in member", async () => {
    expect(
      (await request(ctx.app).get(`${API}/chat/conversations`)).status,
    ).toBe(401);
    expect(
      (await request(ctx.app).get(`${API}/chat/unread-count`)).status,
    ).toBe(401);
  });

  test("every member shares one community group", async () => {
    const [a, b] = await Promise.all([mobileDoctor(), mobileDoctor()]);
    const [groupA, groupB] = await Promise.all([
      communityOf(a),
      communityOf(b),
    ]);
    expect(groupA.id).toBe(groupB.id);
    expect(groupA).toMatchObject({
      type: "GROUP",
      isCommunity: true,
      canSend: true,
      peer: null,
    });
    expect(groupA.name).toBeTruthy();
    expect(groupA.memberCount).toBeGreaterThanOrEqual(2);

    const Conversation = require("../src/models/Conversation");
    expect(await Conversation.countDocuments({ type: "GROUP" })).toBe(1);
  });

  test("messages persist, are ordered, paginated and counted as unread", async () => {
    const [a, b] = await Promise.all([mobileDoctor(), mobileDoctor()]);
    const group = await communityOf(a);
    await communityOf(b);
    await b.post(`/chat/conversations/${group.id}/read`);

    for (let i = 1; i <= 5; i += 1) {
      const sent = await a.post(`/chat/conversations/${group.id}/messages`, {
        body: `  Message ${i}  `,
      });
      expect(sent.status).toBe(201);
      expect(sent.body.data).toMatchObject({
        body: `Message ${i}`,
        conversationId: group.id,
      });
      expect(sent.body.data.sender).toMatchObject({
        id: a.user.id,
        name: a.user.name,
      });
    }

    const listed = await communityOf(b);
    expect(listed.unreadCount).toBe(5);
    expect(listed.lastMessage).toMatchObject({
      preview: "Message 5",
      senderId: a.user.id,
      senderName: a.user.name,
    });
    expect((await b.get("/chat/unread-count")).body.data.unreadCount).toBe(5);
    // The sender's own messages are never unread for the sender.
    expect((await communityOf(a)).unreadCount).toBe(0);

    const newest = await b.get(
      `/chat/conversations/${group.id}/messages?limit=2`,
    );
    expect(newest.body.data.map((m) => m.body)).toEqual([
      "Message 4",
      "Message 5",
    ]);
    expect(newest.body.meta.hasMore).toBe(true);
    const older = await b.get(
      `/chat/conversations/${group.id}/messages?limit=2&before=${newest.body.meta.nextBefore}`,
    );
    expect(older.body.data.map((m) => m.body)).toEqual([
      "Message 2",
      "Message 3",
    ]);

    const read = await b.post(`/chat/conversations/${group.id}/read`);
    expect(read.body.data).toEqual({
      conversationId: group.id,
      unreadCount: 0,
    });
    expect((await communityOf(b)).unreadCount).toBe(0);
  });

  test("a new member starts with the existing history marked as read", async () => {
    const early = await mobileDoctor();
    const group = await communityOf(early);
    await early.post(`/chat/conversations/${group.id}/messages`, {
      body: "Written before the newcomer joined",
    });
    const newcomer = await mobileDoctor();
    const seen = await communityOf(newcomer);
    expect(seen.unreadCount).toBe(0);
    const history = await newcomer.get(
      `/chat/conversations/${group.id}/messages`,
    );
    expect(
      history.body.data.some(
        (m) => m.body === "Written before the newcomer joined",
      ),
    ).toBe(true);
  });

  test("invalid messages are rejected and a retried message is stored once", async () => {
    const a = await mobileDoctor();
    const group = await communityOf(a);
    const url = `/chat/conversations/${group.id}/messages`;

    expect((await a.post(url, { body: "   " })).status).toBe(400);
    expect((await a.post(url, { body: "x".repeat(4001) })).status).toBe(400);
    expect((await a.post(url, { body: "ok", clientId: "short" })).status).toBe(
      400,
    );
    expect((await a.post(url, { body: { $gt: "" } })).status).toBe(400);

    const first = await a.post(url, {
      body: "Sent once",
      clientId: "client-msg-0001",
    });
    const retry = await a.post(url, {
      body: "Sent once",
      clientId: "client-msg-0001",
    });
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(first.body.data.id);
    const Message = require("../src/models/Message");
    expect(await Message.countDocuments({ clientId: "client-msg-0001" })).toBe(
      1,
    );

    // Markup is stored and returned as plain text, never interpreted.
    const html = await a.post(url, { body: "<script>alert(1)</script>" });
    expect(html.body.data.body).toBe("<script>alert(1)</script>");
  });
});

describe("one-to-one chat", () => {
  test("needs a WhatsApp number on the caller’s profile first", async () => {
    const a = await mobileDoctor();
    const b = await chatReadyDoctor();
    const refused = await a.post("/chat/direct", { doctorId: b.user.id });
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("WHATSAPP_REQUIRED");

    await a.patch("/doctors/me", { whatsapp: { number: "+919811122233" } });
    expect((await a.post("/chat/direct", { doctorId: b.user.id })).status).toBe(
      201,
    );
  });

  test("both sides always reach the same single conversation", async () => {
    const [a, b] = await Promise.all([chatReadyDoctor(), chatReadyDoctor()]);
    const opened = await a.post("/chat/direct", { doctorId: b.user.id });
    expect(opened.status).toBe(201);
    expect(opened.body.data).toMatchObject({
      type: "DIRECT",
      isCommunity: false,
      name: b.user.name,
      unreadCount: 0,
    });
    expect(opened.body.data.peer).toMatchObject({
      id: b.user.id,
      name: b.user.name,
      available: true,
    });

    const again = await a.post("/chat/direct", { doctorId: b.user.id });
    const fromOtherSide = await b.post("/chat/direct", { doctorId: a.user.id });
    expect(again.status).toBe(200);
    expect(fromOtherSide.status).toBe(200);
    expect(again.body.data.id).toBe(opened.body.data.id);
    expect(fromOtherSide.body.data.id).toBe(opened.body.data.id);
    expect(fromOtherSide.body.data.peer.id).toBe(a.user.id);

    // Simultaneous first opens still produce exactly one conversation.
    const [c, d] = await Promise.all([chatReadyDoctor(), chatReadyDoctor()]);
    const racing = await Promise.all([
      c.post("/chat/direct", { doctorId: d.user.id }),
      d.post("/chat/direct", { doctorId: c.user.id }),
      c.post("/chat/direct", { doctorId: d.user.id }),
    ]);
    expect(new Set(racing.map((r) => r.body.data.id)).size).toBe(1);
    const Conversation = require("../src/models/Conversation");
    const ConversationMember = require("../src/models/ConversationMember");
    expect(
      await Conversation.countDocuments({
        participants: { $all: [c.user.id, d.user.id] },
      }),
    ).toBe(1);
    expect(
      await ConversationMember.countDocuments({
        conversation: racing[0].body.data.id,
      }),
    ).toBe(2);
  });

  test("only the two participants can read, send or mark it read", async () => {
    const [a, b, outsider] = await Promise.all([
      chatReadyDoctor(),
      chatReadyDoctor(),
      chatReadyDoctor(),
    ]);
    const { id } = (await a.post("/chat/direct", { doctorId: b.user.id })).body
      .data;
    await a.post(`/chat/conversations/${id}/messages`, {
      body: "Private hello",
    });

    for (const res of [
      await outsider.get(`/chat/conversations/${id}`),
      await outsider.get(`/chat/conversations/${id}/messages`),
      await outsider.post(`/chat/conversations/${id}/messages`, {
        body: "Let me in",
      }),
      await outsider.post(`/chat/conversations/${id}/read`),
    ]) {
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("Private hello");
    }
    const outsiderList = await outsider.get("/chat/conversations");
    expect(outsiderList.body.data.some((c) => c.id === id)).toBe(false);
    expect(JSON.stringify(outsiderList.body)).not.toContain("Private hello");

    const inbox = await b.get("/chat/conversations?type=DIRECT");
    expect(inbox.body.data).toHaveLength(1);
    expect(inbox.body.data[0]).toMatchObject({
      id,
      unreadCount: 1,
      name: a.user.name,
    });
    const history = await b.get(`/chat/conversations/${id}/messages`);
    expect(history.body.data.map((m) => m.body)).toEqual(["Private hello"]);

    const Message = require("../src/models/Message");
    expect(await Message.countDocuments({ conversation: id })).toBe(1);
  });

  test("refuses impossible or hidden targets", async () => {
    const a = await chatReadyDoctor();
    const hidden = await mobileDoctor();
    await hidden.patch("/doctors/me", { visibility: { directory: false } });
    const admin = await createAdmin(ctx.app);

    expect((await a.post("/chat/direct", { doctorId: a.user.id })).status).toBe(
      400,
    );
    expect(
      (await a.post("/chat/direct", { doctorId: "not-an-id" })).status,
    ).toBe(400);
    expect(
      (await a.post("/chat/direct", { doctorId: "a".repeat(24) })).status,
    ).toBe(404);
    expect(
      (await a.post("/chat/direct", { doctorId: hidden.user.id })).status,
    ).toBe(404);
    expect(
      (await a.post("/chat/direct", { doctorId: admin.user.id })).status,
    ).toBe(404);
  });

  test("the peer’s WhatsApp number follows their visibility setting", async () => {
    const a = await chatReadyDoctor();
    const b = await mobileDoctor();
    await b.patch("/doctors/me", { whatsapp: { number: "+447700900456" } });

    const { id, peer } = (await a.post("/chat/direct", { doctorId: b.user.id }))
      .body.data;
    expect(peer.whatsapp).toBe("+447700900456");

    await b.patch("/doctors/me", { visibility: { showWhatsapp: false } });
    const hidden = await a.get(`/chat/conversations/${id}`);
    expect(hidden.body.data.peer.whatsapp).toBeNull();
    expect(JSON.stringify(hidden.body)).not.toContain("447700900456");

    // A doctor without a number simply has none to show.
    const c = await mobileDoctor();
    const withC = await a.post("/chat/direct", { doctorId: c.user.id });
    expect(withC.body.data.peer.whatsapp).toBeNull();
  });

  test("deleting a doctor removes their conversations and messages", async () => {
    const [a, b] = await Promise.all([chatReadyDoctor(), chatReadyDoctor()]);
    const admin = await createAdmin(ctx.app);
    const { id } = (await a.post("/chat/direct", { doctorId: b.user.id })).body
      .data;
    await a.post(`/chat/conversations/${id}/messages`, {
      body: "Soon to be removed",
    });
    const group = await communityOf(a);
    await a.post(`/chat/conversations/${group.id}/messages`, {
      body: "Group message from a deleted account",
    });

    expect(
      (
        await admin.delete(`${API}/admin/doctors/${a.user.id}`, {
          reason: "Test removal",
        })
      ).status,
    ).toBe(200);

    expect((await b.get(`/chat/conversations/${id}`)).status).toBe(404);
    expect(
      (await b.get("/chat/conversations?type=DIRECT")).body.data,
    ).toHaveLength(0);
    const Message = require("../src/models/Message");
    expect(await Message.countDocuments({ sender: a.user.id })).toBe(0);
    const after = await communityOf(b);
    expect(
      after.lastMessage === null ||
        after.lastMessage.preview !== "Group message from a deleted account",
    ).toBe(true);
  });
});

describe("reactions", () => {
  test("a member keeps one reaction per message, can change or remove it, and outsiders cannot react", async () => {
    const [a, b, outsider] = await Promise.all([
      chatReadyDoctor(),
      chatReadyDoctor(),
      chatReadyDoctor(),
    ]);
    const { id } = (await a.post("/chat/direct", { doctorId: b.user.id })).body
      .data;
    const sent = await a.post(`/chat/conversations/${id}/messages`, {
      body: "React to me",
    });
    expect(sent.body.data.reactions).toEqual([]);
    const url = `/chat/conversations/${id}/messages/${sent.body.data.id}/reaction`;

    let res = await b.put(url, { emoji: "👍" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      conversationId: id,
      messageId: sent.body.data.id,
      reactions: [{ emoji: "👍", userIds: [b.user.id] }],
    });
    await a.put(url, { emoji: "👍" });
    // A new emoji replaces the member's previous one.
    res = await b.put(url, { emoji: "❤️" });
    expect(res.body.data.reactions).toEqual([
      { emoji: "👍", userIds: [a.user.id] },
      { emoji: "❤️", userIds: [b.user.id] },
    ]);

    // History carries the reactions, and reacting does not count as unread.
    const history = await b.get(`/chat/conversations/${id}/messages`);
    expect(history.body.data[0].reactions).toEqual(res.body.data.reactions);
    const listed = (await a.get("/chat/conversations?type=DIRECT")).body.data;
    expect(listed[0]).toMatchObject({ unreadCount: 0 });
    expect(listed[0].lastMessage.preview).toBe("React to me");

    res = await a.put(url, { emoji: "" });
    expect(res.body.data.reactions).toEqual([
      { emoji: "❤️", userIds: [b.user.id] },
    ]);

    expect((await b.put(url, { emoji: "🔥" })).status).toBe(400);
    expect((await outsider.put(url, { emoji: "👍" })).status).toBe(404);
    // A message id from another conversation is not found here.
    const group = await communityOf(a);
    const other = await a.post(`/chat/conversations/${group.id}/messages`, {
      body: "Group message",
    });
    expect(
      (
        await a.put(
          `/chat/conversations/${id}/messages/${other.body.data.id}/reaction`,
          { emoji: "👍" },
        )
      ).status,
    ).toBe(404);
  });

  test("a deleted account's reactions are removed", async () => {
    const [a, b] = await Promise.all([mobileDoctor(), mobileDoctor()]);
    const admin = await createAdmin(ctx.app);
    const group = await communityOf(a);
    const sent = await a.post(`/chat/conversations/${group.id}/messages`, {
      body: "Stays after b leaves",
    });
    await b.put(
      `/chat/conversations/${group.id}/messages/${sent.body.data.id}/reaction`,
      { emoji: "😂" },
    );
    expect(
      (
        await admin.delete(`${API}/admin/doctors/${b.user.id}`, {
          reason: "Test removal",
        })
      ).status,
    ).toBe(200);
    const Message = require("../src/models/Message");
    const stored = await Message.findById(sent.body.data.id).lean();
    expect(stored.reactions).toEqual([]);
  });
});

describe("real-time delivery (Socket.IO)", () => {
  let server;
  let io;
  let url;
  const sockets = [];

  beforeAll(async () => {
    const { attachRealtime } = require("../src/realtime/gateway");
    server = http.createServer(ctx.app);
    io = attachRealtime(server);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    const { closeRealtime } = require("../src/realtime/gateway");
    await closeRealtime(io);
    await new Promise((resolve) => server.close(resolve));
  });

  // Resolves once the server has finished joining the socket to its rooms.
  function open(token) {
    return new Promise((resolve, reject) => {
      const socket = connect(url, {
        auth: token === undefined ? {} : { token },
        transports: ["websocket"],
        reconnection: false,
      });
      sockets.push(socket);
      socket.received = [];
      socket.on("message:new", (payload) => socket.received.push(payload));
      socket.once("ready", () => resolve(socket));
      socket.once("connect_error", (err) => reject(err));
    });
  }

  const emit = (socket, event, payload) =>
    new Promise((resolve) => socket.emit(event, payload, resolve));
  const settle = (ms = 150) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  test("a connection needs a valid session token", async () => {
    await expect(open(undefined)).rejects.toMatchObject({
      data: { code: "UNAUTHENTICATED" },
    });
    await expect(open("not-a-token")).rejects.toMatchObject({
      data: { code: "SESSION_EXPIRED" },
    });
  });

  test("a message reaches the other participant live, and nobody else", async () => {
    const [a, b, outsider] = await Promise.all([
      chatReadyDoctor(),
      chatReadyDoctor(),
      chatReadyDoctor(),
    ]);
    const { id } = (await a.post("/chat/direct", { doctorId: b.user.id })).body
      .data;
    const [sa, sb, so] = await Promise.all([
      open(a.token),
      open(b.token),
      open(outsider.token),
    ]);

    const ack = await emit(sa, "message:send", {
      conversationId: id,
      body: "Hello in real time",
      clientId: "rt-client-0001",
    });
    expect(ack.ok).toBe(true);
    expect(ack.message).toMatchObject({
      body: "Hello in real time",
      conversationId: id,
      clientId: "rt-client-0001",
    });
    await settle();

    expect(sb.received.map((p) => p.message.body)).toEqual([
      "Hello in real time",
    ]);
    expect(sb.received[0].message.sender.id).toBe(a.user.id);
    expect(sa.received).toHaveLength(1); // the sender's other devices are kept in sync too
    expect(so.received).toHaveLength(0);

    // It was really stored, not just relayed.
    const history = await b.get(`/chat/conversations/${id}/messages`);
    expect(history.body.data.map((m) => m.body)).toEqual([
      "Hello in real time",
    ]);

    // Resending after a lost acknowledgement does not duplicate it.
    const retry = await emit(sa, "message:send", {
      conversationId: id,
      body: "Hello in real time",
      clientId: "rt-client-0001",
    });
    expect(retry).toMatchObject({ ok: true, duplicate: true });
    expect(retry.message.id).toBe(ack.message.id);
    await settle();
    expect(sb.received).toHaveLength(1);

    // A message sent through REST is pushed to connected devices as well.
    await b.post(`/chat/conversations/${id}/messages`, {
      body: "Reply over REST",
    });
    await settle();
    expect(sa.received.map((p) => p.message.body)).toEqual([
      "Hello in real time",
      "Reply over REST",
    ]);
    expect(so.received).toHaveLength(0);
  });

  test("a socket cannot write to or subscribe to a conversation it is not part of", async () => {
    const [a, b, outsider] = await Promise.all([
      chatReadyDoctor(),
      chatReadyDoctor(),
      chatReadyDoctor(),
    ]);
    const { id } = (await a.post("/chat/direct", { doctorId: b.user.id })).body
      .data;
    const [sb, so] = await Promise.all([open(b.token), open(outsider.token)]);

    const refused = await emit(so, "message:send", {
      conversationId: id,
      body: "Intruding",
    });
    expect(refused).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(
      (await emit(so, "conversation:read", { conversationId: id })).ok,
    ).toBe(false);

    // Made-up subscription events are simply ignored.
    so.emit("join", `conversation:${id}`);
    so.emit("subscribe", { conversationId: id });
    await a.post(`/chat/conversations/${id}/messages`, {
      body: "Still private",
    });
    await settle();
    expect(sb.received.map((p) => p.message.body)).toEqual(["Still private"]);
    expect(so.received).toHaveLength(0);

    expect(
      await emit(sb, "message:send", { conversationId: id }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(await emit(sb, "message:send", "nonsense")).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  test("a conversation opened after connecting is delivered without reconnecting", async () => {
    const [a, b] = await Promise.all([chatReadyDoctor(), chatReadyDoctor()]);
    const [sa, sb] = await Promise.all([open(a.token), open(b.token)]);
    const { id } = (await a.post("/chat/direct", { doctorId: b.user.id })).body
      .data;
    await settle();
    const ack = await emit(sa, "message:send", {
      conversationId: id,
      body: "First message of a new chat",
    });
    expect(ack.ok).toBe(true);
    await settle();
    expect(sb.received.map((p) => p.message.body)).toEqual([
      "First message of a new chat",
    ]);
  });

  test("group messages reach every connected member", async () => {
    const [a, b] = await Promise.all([mobileDoctor(), mobileDoctor()]);
    const [sa, sb] = await Promise.all([open(a.token), open(b.token)]);
    const group = await communityOf(a);
    const ack = await emit(sa, "message:send", {
      conversationId: group.id,
      body: "Good morning, everyone",
    });
    expect(ack.ok).toBe(true);
    await settle();
    expect(
      sb.received.some(
        (p) =>
          p.conversationId === group.id &&
          p.message.body === "Good morning, everyone",
      ),
    ).toBe(true);

    const read = await emit(sb, "conversation:read", {
      conversationId: group.id,
    });
    expect(read).toMatchObject({ ok: true, unreadCount: 0 });
  });

  test("reactions reach every member live", async () => {
    const [a, b] = await Promise.all([mobileDoctor(), mobileDoctor()]);
    const [sa, sb] = await Promise.all([open(a.token), open(b.token)]);
    const reactions = [];
    sa.on("message:reaction", (payload) => reactions.push(payload));
    const group = await communityOf(a);
    const sent = await emit(sa, "message:send", {
      conversationId: group.id,
      body: "Live reaction please",
    });
    const ack = await emit(sb, "message:react", {
      conversationId: group.id,
      messageId: sent.message.id,
      emoji: "🙏",
    });
    expect(ack).toMatchObject({
      ok: true,
      reactions: [{ emoji: "🙏", userIds: [b.user.id] }],
    });
    await settle();
    expect(reactions).toContainEqual({
      conversationId: group.id,
      messageId: sent.message.id,
      reactions: [{ emoji: "🙏", userIds: [b.user.id] }],
    });
    const refused = await emit(sb, "message:react", {
      conversationId: group.id,
      messageId: sent.message.id,
      emoji: "not an emoji",
    });
    expect(refused).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  test("signing out ends the live connection", async () => {
    const a = await mobileDoctor();
    const socket = await open(a.token);
    const closed = new Promise((resolve) => socket.once("disconnect", resolve));
    expect((await a.post("/auth/logout")).status).toBe(200);
    await closed;
    expect(socket.connected).toBe(false);
    await expect(open(a.token)).rejects.toMatchObject({
      data: { code: "SESSION_EXPIRED" },
    });
  });
});
