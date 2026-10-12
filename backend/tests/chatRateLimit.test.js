// Uses a real (low) chat limit. It is set before the app reads its
// configuration, which happens lazily inside setupTestApp().
process.env.RATE_LIMIT_CHAT_MAX = '5';

const request = require('supertest');
const { setupTestApp, doctorPayload } = require('./helpers/harness');

const ctx = setupTestApp();
const API = '/api/v1';

async function mobileDoctor() {
  const res = await request(ctx.app).post(`${API}/auth/register`).set('X-Client-Type', 'mobile').send(doctorPayload());
  const { token } = res.body.data;
  return {
    get: (url) => request(ctx.app).get(`${API}${url}`).set('Authorization', `Bearer ${token}`),
    post: (url, body) => request(ctx.app).post(`${API}${url}`).set('Authorization', `Bearer ${token}`).send(body),
  };
}

describe('chat rate limiting', () => {
  test('a member who floods a conversation is throttled; others are not', async () => {
    const [flooder, other] = await Promise.all([mobileDoctor(), mobileDoctor()]);
    const group = (await flooder.get('/chat/conversations')).body.data.find((c) => c.isCommunity);
    const url = `/chat/conversations/${group.id}/messages`;

    for (let i = 0; i < 5; i += 1) {
      expect((await flooder.post(url, { body: `Message ${i}` })).status).toBe(201);
    }
    const blocked = await flooder.post(url, { body: 'One too many' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');

    expect((await other.post(url, { body: 'Unaffected' })).status).toBe(201);
    const history = await other.get(`${url}?limit=50`);
    expect(history.body.data.some((m) => m.body === 'One too many')).toBe(false);
  });
});
