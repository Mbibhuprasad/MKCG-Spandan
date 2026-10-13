const store = new Map();
export const getItemAsync = async (key) => (store.has(key) ? store.get(key) : null);
export const setItemAsync = async (key, value) => void store.set(key, String(value));
export const deleteItemAsync = async (key) => void store.delete(key);
