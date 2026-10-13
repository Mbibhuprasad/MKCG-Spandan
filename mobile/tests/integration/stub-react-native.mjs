export const opened = [];
export const Linking = { openURL: async (url) => void opened.push(url) };
export const AppState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
