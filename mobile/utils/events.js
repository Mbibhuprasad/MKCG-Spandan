// A very small publish/subscribe used to tell lists that their data changed
// (for example: a blog was published, so "recent blogs" should reload).
const listeners = new Map();

export function subscribe(topic, listener) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(listener);
  return () => {
    const set = listeners.get(topic);
    if (set) set.delete(listener);
  };
}

export function publish(topic, payload) {
  const set = listeners.get(topic);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener(payload);
    } catch {
      // one failing listener must not stop the others
    }
  }
}

// Topics for content lists; invalidate('blogs') makes every list of blogs reload.
export const invalidate = (...topics) => topics.forEach((topic) => publish(`invalidate:${topic}`));
export const onInvalidate = (topic, listener) => subscribe(`invalidate:${topic}`, listener);
