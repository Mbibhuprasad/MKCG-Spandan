// Chat photos, "delete for everyone", reactions on every kind of message, the
// protected photo download, and the website's one-time socket ticket.
const http = require("http");
const { Readable } = require("stream");
const request = require("supertest");
const { io: connect } = require("socket.io-client");
const cloudinaryMock = require("cloudinary");
const {
  setupTestApp,
  doctorPayload,
  registerDoctor,
  PNG,
  JPEG,
  EXE,
} = require("./helpers/harness");

const ctx = setupTestApp();
const API = "/api/v1";

// A mobile-style client: bearer token, no cookies, no Origin header.
async function mobileDoctor({ whatsapp = true } = {}) {
  const res = await request(ctx.app)
    .post(`${API}/auth/register`)
    .set("X-Client-Type", "mobile")
    .send(doctorPayload());
  if (res.status !== 201) throw new Error(`Registration failed: ${res.status}`);
  const { token, user } = res.body.data;
  const auth = (req) => req.set("Authorization", `Bearer ${token}`);
  const doctor = {
    token,
    user,
    get: (url) => auth(request(ctx.app).get(`${API}${url}`)),
    post: (url, body) => auth(request(ctx.app).post(`${API}${url}`)).send(body),
    put: (url, body) => auth(request(ctx.app).put(`${API}${url}`)).send(body),
    patch: (url, body) => auth(request(ctx.app).patch(`${API}${url}`)).send(body),
    delete: (url) => auth(request(ctx.app).delete(`${API}${url}`)),
    uploadTo: (conversationId, buffer, filename = "photo.png", contentType = "image/png") =>
      auth(request(ctx.app).post(`${API}/chat/conversations/${conversationId}/images`)).attach("file", buffer, {
        filename,
        contentType,
      }),
  };
  if (whatsapp) {
    const saved = await doctor.patch("/doctors/me", { whatsapp: { sameAsPhone: true } });
    expect(saved.status).toBe(200);
  }
  return doctor;
}

const communityOf = async (doctor) => {
  const res = await doctor.get("/chat/conversations?type=GROUP");
  return res.body.data.find((c) => c.isCommunity);
};

async function directPair() {
  const [a, b] = await Promise.all([mobileDoctor(), mobileDoctor()]);
  const opened = await a.post("/chat/direct", { doctorId: b.user.id });
  return { a, b, id: opened.body.data.id };
}

async function sendPhoto(doctor, conversationId, extra = {}) {
  const uploaded = await doctor.uploadTo(conversationId, PNG);
  expect(uploaded.status).toBe(201);
  const sent = await doctor.post(`/chat/conversations/${conversationId}/messages`, {
    mediaId: uploaded.body.data.id,
    ...extra,
  });
  return { uploaded: uploaded.body.data, sent };
}

describe("photos in chat", () => {
  test("a member uploads a photo to a conversation and sends it, in one-to-one and group chat", async () => {
    const { a, b, id } = await directPair();
    const { uploaded, sent } = await sendPhoto(a, id, { body: "  Our old campus  " });
    expect(uploaded).toMatchObject({ format: "png", width: 640, height: 480 });
    expect(uploaded.previewUrl).toContain("/authenticated/s--testsig--/");
    expect(sent.status).toBe(201);
    expect(sent.body.data).toMatchObject({
      type: "IMAGE",
      body: "Our old campus",
      deleted: false,
      image: { id: uploaded.id, format: "png" },
      reactions: [],
    });

    // The other participant sees it in history, and the list shows a photo preview.
    const history = await b.get(`/chat/conversations/${id}/messages`);
    expect(history.body.data.at(-1)).toMatchObject({ id: sent.body.data.id, type: "IMAGE" });
    expect(history.body.data.at(-1).image.url).toContain("res.cloudinary.com");
    const list = await b.get("/chat/conversations?type=DIRECT");
    expect(list.body.data[0].lastMessage.preview).toBe("📷 Our old campus");

    // The upload is claimed by the message, so it cannot be sent a second time.
    const again = await a.post(`/chat/conversations/${id}/messages`, { mediaId: uploaded.id });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe("MEDIA_INVALID");

    const group = await communityOf(a);
    const inGroup = await sendPhoto(a, group.id);
    expect(inGroup.sent.status).toBe(201);
    expect(inGroup.sent.body.data).toMatchObject({ type: "IMAGE", body: "" });
    const groupList = await a.get("/chat/conversations?type=GROUP");
    expect(groupList.body.data.find((c) => c.isCommunity).lastMessage.preview).toBe("📷 Photo");
  });

  test("uploads are checked: membership, real file type, size, and nobody can send another member's upload", async () => {
    const { a, b, id } = await directPair();
    const outsider = await mobileDoctor();

    const notMember = await outsider.uploadTo(id, PNG);
    expect(notMember.status).toBe(404);

    const disguised = await a.uploadTo(id, EXE, "photo.png", "image/png");
    expect(disguised.status).toBe(400);
    expect(disguised.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");

    const huge = await a.uploadTo(id, Buffer.concat([PNG, Buffer.alloc(1.2 * 1024 * 1024)]));
    expect(huge.status).toBe(413);

    const jpeg = await a.uploadTo(id, JPEG, "photo.jpg", "image/jpeg");
    expect(jpeg.status).toBe(201);

    // b cannot send a's upload, and the generic upload endpoint refuses chat photos.
    const stolen = await b.post(`/chat/conversations/${id}/messages`, { mediaId: jpeg.body.data.id });
    expect(stolen.status).toBe(400);
    const generic = await request(ctx.app)
      .post(`${API}/media`)
      .set("Authorization", `Bearer ${a.token}`)
      .field("purpose", "chat")
      .attach("file", PNG, { filename: "p.png", contentType: "image/png" });
    expect(generic.status).toBe(400);

    // A message needs text or a photo.
    const empty = await a.post(`/chat/conversations/${id}/messages`, { body: "   " });
    expect(empty.status).toBe(400);
  });

  test("a member without a WhatsApp number cannot upload into a one-to-one chat", async () => {
    const a = await mobileDoctor();
    const b = await mobileDoctor({ whatsapp: false });
    const { id } = (await a.post("/chat/direct", { doctorId: b.user.id })).body.data;
    const refused = await b.uploadTo(id, PNG);
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe("WHATSAPP_REQUIRED");
  });

  test("the original photo is streamed only to members, with a download filename", async () => {
    const { a, b, id } = await directPair();
    const outsider = await mobileDoctor();
    const { sent } = await sendPhoto(a, id);
    const url = `/chat/conversations/${id}/messages/${sent.body.data.id}/image`;

    const cloud = require("../src/services/cloudinary.service");
    const spy = jest.spyOn(cloud, "fetchOriginal").mockImplementation(async () => ({
      headers: new Headers({ "content-length": String(PNG.length) }),
      body: Readable.toWeb(Readable.from([PNG])),
    }));
    try {
      const res = await b.get(url).buffer(true).parse((r, done) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => done(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("image/png");
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="mkcgspandan-chat-\d{8}-\d{6}\.png"$/);
      expect(res.headers["cache-control"]).toBe("private, no-store");
      expect(Buffer.compare(res.body, PNG)).toBe(0);
      // The asset fetched is the one that belongs to this message.
      expect(String(spy.mock.calls[0][0]._id)).toBe(sent.body.data.image.id);

      expect((await outsider.get(url)).status).toBe(404);
      const textMessage = await a.post(`/chat/conversations/${id}/messages`, { body: "no photo here" });
      expect((await b.get(`/chat/conversations/${id}/messages/${textMessage.body.data.id}/image`)).status).toBe(404);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("reactions", () => {
  test("every listed emoji, including 😊, can be set on text and photo messages and stays on the right message", async () => {
    const { a, b, id } = await directPair();
    const first = await a.post(`/chat/conversations/${id}/messages`, { body: "First" });
    const { sent: photo } = await sendPhoto(a, id);
    const third = await a.post(`/chat/conversations/${id}/messages`, { body: "Third" });

    for (const emoji of ["👍", "❤️", "😂", "😊", "😮", "😢", "🙏"]) {
      const res = await b.put(`/chat/conversations/${id}/messages/${first.body.data.id}/reaction`, { emoji });
      expect(res.status).toBe(200);
      expect(res.body.data.reactions).toEqual([{ emoji, userIds: [b.user.id] }]);
    }

    const onPhoto = await b.put(`/chat/conversations/${id}/messages/${photo.body.data.id}/reaction`, { emoji: "😊" });
    expect(onPhoto.body.data).toMatchObject({ messageId: photo.body.data.id, reactions: [{ emoji: "😊", userIds: [b.user.id] }] });
    await a.put(`/chat/conversations/${id}/messages/${photo.body.data.id}/reaction`, { emoji: "😊" });

    // Persisted, counted per message, and the neighbours are untouched.
    const history = (await a.get(`/chat/conversations/${id}/messages`)).body.data;
    const byId = Object.fromEntries(history.map((m) => [m.id, m]));
    expect(byId[first.body.data.id].reactions).toEqual([{ emoji: "🙏", userIds: [b.user.id] }]);
    expect(byId[photo.body.data.id].reactions).toEqual([{ emoji: "😊", userIds: [b.user.id, a.user.id] }]);
    expect(byId[third.body.data.id].reactions).toEqual([]);

    // The emoji is stored exactly (multi-code-point ❤️ included).
    await b.put(`/chat/conversations/${id}/messages/${third.body.data.id}/reaction`, { emoji: "❤️" });
    const Message = require("../src/models/Message");
    const stored = await Message.findById(third.body.data.id).lean();
    expect(stored.reactions[0].emoji).toBe("❤️");

    const unknown = await b.put(`/chat/conversations/${id}/messages/${third.body.data.id}/reaction`, { emoji: "🔥" });
    expect(unknown.status).toBe(400);
  });
});

describe("delete for everyone", () => {
  test("only the sender can delete; the content is gone for everyone, also after reloading", async () => {
    const { a, b, id } = await directPair();
    const text = await a.post(`/chat/conversations/${id}/messages`, { body: "A private thought" });
    await b.put(`/chat/conversations/${id}/messages/${text.body.data.id}/reaction`, { emoji: "😊" });
    const url = `/chat/conversations/${id}/messages/${text.body.data.id}`;

    const notSender = await b.delete(url);
    expect(notSender.status).toBe(403);
    expect(notSender.body.error.code).toBe("NOT_MESSAGE_SENDER");

    const removed = await a.delete(url);
    expect(removed.status).toBe(200);
    expect(removed.body.data.message).toMatchObject({
      id: text.body.data.id,
      deleted: true,
      body: "",
      image: null,
      reactions: [],
      sender: { id: a.user.id },
    });

    // History (the "refresh") returns the deleted state, never the old text.
    const history = await b.get(`/chat/conversations/${id}/messages`);
    const shown = history.body.data.find((m) => m.id === text.body.data.id);
    expect(shown).toMatchObject({ deleted: true, body: "", reactions: [] });
    expect(JSON.stringify(history.body)).not.toContain("A private thought");
    const Message = require("../src/models/Message");
    const stored = await Message.findById(text.body.data.id).lean();
    expect(stored.body).toBe("");
    expect(stored.reactions).toEqual([]);
    expect(stored.deletedBy.toString()).toBe(a.user.id);

    const list = await b.get("/chat/conversations?type=DIRECT");
    expect(list.body.data[0].lastMessage.preview).toBe("This message was deleted");

    // Repeating the request is harmless; reacting to a deleted message is refused.
    const again = await a.delete(url);
    expect(again.status).toBe(200);
    expect(again.body.data.message.deleted).toBe(true);
    const react = await b.put(`${url}/reaction`, { emoji: "👍" });
    expect(react.status).toBe(409);
    expect(react.body.error.code).toBe("MESSAGE_DELETED");

    const outsider = await mobileDoctor();
    expect((await outsider.delete(url)).status).toBe(404);
  });

  test("deleting a photo removes it from Cloudinary and from every response", async () => {
    const { a, b, id } = await directPair();
    const { uploaded, sent } = await sendPhoto(a, id, { body: "caption" });
    const removed = await a.delete(`/chat/conversations/${id}/messages/${sent.body.data.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.message).toMatchObject({ deleted: true, image: null, body: "" });

    const Media = require("../src/models/Media");
    expect(await Media.findById(uploaded.id)).toBeNull();
    expect(cloudinaryMock.__state.destroyed.map((d) => d.publicId)).toContainEqual(expect.stringContaining("/chat/"));

    const history = await b.get(`/chat/conversations/${id}/messages`);
    expect(JSON.stringify(history.body)).not.toContain(uploaded.previewUrl);
    expect(JSON.stringify(history.body)).not.toContain("caption");
    const download = await b.get(`/chat/conversations/${id}/messages/${sent.body.data.id}/image`);
    expect(download.status).toBe(409);
  });
});

describe("real time", () => {
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

  function open(auth) {
    return new Promise((resolve, reject) => {
      const socket = connect(url, { auth, transports: ["websocket"], reconnection: false, forceNew: true });
      sockets.push(socket);
      socket.events = [];
      for (const name of ["message:new", "message:deleted", "message:reaction"]) {
        socket.on(name, (payload) => socket.events.push({ name, payload }));
      }
      socket.once("ready", () => resolve(socket));
      socket.once("connect_error", (err) => reject(err));
    });
  }
  const emit = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));
  const settle = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

  test("deletion, photos and reactions reach the other member live; a member who was offline gets the deleted state", async () => {
    const { a, b, id } = await directPair();
    const [sa, sb] = await Promise.all([open({ token: a.token }), open({ token: b.token })]);

    const { sent: photo } = await sendPhoto(a, id);
    await settle();
    expect(sb.events.find((e) => e.name === "message:new").payload.message).toMatchObject({ type: "IMAGE", id: photo.body.data.id });

    const reacted = await emit(sb, "message:react", { conversationId: id, messageId: photo.body.data.id, emoji: "😊" });
    expect(reacted.ok).toBe(true);
    await settle();
    expect(sa.events.find((e) => e.name === "message:reaction").payload).toMatchObject({
      messageId: photo.body.data.id,
      reactions: [{ emoji: "😊", userIds: [b.user.id] }],
    });

    const refused = await emit(sb, "message:delete", { conversationId: id, messageId: photo.body.data.id });
    expect(refused).toMatchObject({ ok: false, error: { code: "NOT_MESSAGE_SENDER" } });

    // b goes offline; a deletes over the socket.
    sb.disconnect();
    const deleted = await emit(sa, "message:delete", { conversationId: id, messageId: photo.body.data.id });
    expect(deleted.ok).toBe(true);
    expect(deleted.message).toMatchObject({ deleted: true, image: null });
    await settle();
    expect(sa.events.find((e) => e.name === "message:deleted").payload).toMatchObject({
      conversationId: id,
      messageId: photo.body.data.id,
      message: { deleted: true },
    });

    // On reconnecting, b reloads history and sees the deleted state.
    const sb2 = await open({ token: b.token });
    expect(sb2.connected).toBe(true);
    const history = await b.get(`/chat/conversations/${id}/messages`);
    expect(history.body.data.find((m) => m.id === photo.body.data.id)).toMatchObject({ deleted: true, image: null });
  });

  test("the website opens a socket with a one-time ticket, which is useless anywhere else", async () => {
    const web = await registerDoctor(ctx.app);
    const phone = await mobileDoctor();
    const group = await communityOf(phone);

    // The ticket endpoint needs the session cookie and its CSRF token.
    expect((await request(ctx.app).post(`${API}/chat/socket-ticket`)).status).toBe(401);
    const noCsrf = await web.agent.post(`${API}/chat/socket-ticket`).set("Origin", "http://localhost:5000");
    expect(noCsrf.status).toBe(403);

    const issued = await web.post(`${API}/chat/socket-ticket`);
    expect(issued.status).toBe(200);
    const { ticket, expiresInSeconds } = issued.body.data;
    expect(expiresInSeconds).toBe(60);

    // Not a bearer token for the REST API.
    const asBearer = await request(ctx.app).get(`${API}/chat/conversations`).set("Authorization", `Bearer ${ticket}`);
    expect(asBearer.status).toBe(401);

    await web.get(`${API}/chat/conversations`); // joins the community group
    const socket = await open({ ticket });
    await phone.post(`/chat/conversations/${group.id}/messages`, { body: "Hello website" });
    await settle();
    expect(socket.events.filter((e) => e.name === "message:new").map((e) => e.payload.message.body)).toContain("Hello website");

    const sent = await emit(socket, "message:send", { conversationId: group.id, body: "Hello phone 😊", clientId: "web-ticket-0001" });
    expect(sent.ok).toBe(true);
    expect(sent.message.sender.id).toBe(web.user.id);

    // Used once only, and a session token in the ticket slot is refused.
    await expect(open({ ticket })).rejects.toMatchObject({ data: { code: "SESSION_EXPIRED" } });
    await expect(open({ ticket: phone.token })).rejects.toMatchObject({ data: { code: "SESSION_EXPIRED" } });

    // Logging out ends the ticket socket too.
    const closed = new Promise((resolve) => socket.once("disconnect", resolve));
    await web.post(`${API}/auth/logout`);
    await closed;
  });
});
