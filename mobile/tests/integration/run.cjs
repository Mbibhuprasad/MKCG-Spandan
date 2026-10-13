/* eslint-disable no-console */
// Loads the mobile app's own JavaScript modules in Node — the API client, the
// socket service, the feature API modules, the profile model and the utils —
// and runs tests.mjs against a running API. Only what is native to a phone is
// replaced: expo-constants, expo-secure-store and react-native's Linking get
// tiny stand-ins, and XMLHttpRequest/FormData are adapted to Node's fetch.
// Usage: npm run test:api [-- <api origin>]   (default http://localhost:5100)
//
// The tests register accounts and post content, so point them ONLY at the
// isolated test API (npm run test:api-server) — never at a real deployment.
const fs = require('fs');
const path = require('path');
const { registerHooks } = require('module');
const { pathToFileURL, fileURLToPath } = require('url');

const mobile = path.resolve(__dirname, '../..');
const here = __dirname;
process.env.EXPO_PUBLIC_API_URL = process.argv[2] || process.env.MKCG_TEST_API_URL || 'http://localhost:5100';
process.env.MKCG_MOBILE_DIR = mobile;
globalThis.__DEV__ = true;

const STUBS = {
  'expo-constants': path.join(here, 'stub-constants.mjs'),
  'expo-secure-store': path.join(here, 'stub-secure-store.mjs'),
  'react-native': path.join(here, 'stub-react-native.mjs'),
};

function resolveFile(base) {
  for (const candidate of [base, `${base}.js`, path.join(base, 'index.js')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (STUBS[specifier]) return { url: pathToFileURL(STUBS[specifier]).href, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const file = resolveFile(path.join(mobile, specifier.slice(2)));
      if (!file) throw new Error(`Cannot resolve ${specifier}`);
      return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    const parent = context.parentURL && context.parentURL.startsWith('file:') ? fileURLToPath(context.parentURL) : '';
    const inApp = parent.startsWith(mobile) && !parent.includes('node_modules');
    if (inApp && specifier.startsWith('.')) {
      const file = resolveFile(path.resolve(path.dirname(parent), specifier));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    if (!specifier.startsWith('.') && !specifier.startsWith('file:') && !specifier.startsWith('node:') && (inApp || parent.startsWith(here))) {
      // Bare imports (socket.io-client) come from the app's own node_modules.
      try {
        return { url: pathToFileURL(require.resolve(specifier, { paths: [mobile] })).href, shortCircuit: true };
      } catch {
        // fall through to Node's own resolution
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:')) {
      const file = fileURLToPath(url);
      if (file.startsWith(mobile) && !file.includes('node_modules') && file.endsWith('.js')) {
        return { format: 'module', source: fs.readFileSync(file, 'utf8'), shortCircuit: true };
      }
    }
    return nextLoad(url, context);
  },
});

/* React Native's FormData accepts { uri, name, type } for a file, and uploads
   go through XMLHttpRequest. Node has neither, so both are adapted here. */
const NodeFormData = globalThis.FormData;
globalThis.FormData = class extends NodeFormData {
  append(name, value, filename) {
    if (value && typeof value === 'object' && typeof value.uri === 'string') {
      const bytes = fs.readFileSync(value.uri.replace(/^file:\/\//, ''));
      return super.append(name, new Blob([bytes], { type: value.type }), value.name);
    }
    return filename === undefined ? super.append(name, value) : super.append(name, value, filename);
  }
};
globalThis.XMLHttpRequest = class {
  constructor() {
    this.headers = {};
    this.upload = {};
    this.status = 0;
    this.responseText = '';
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name, value) {
    this.headers[name] = value;
  }
  send(body) {
    fetch(this.url, { method: this.method, headers: this.headers, body })
      .then(async (res) => {
        this.status = res.status;
        this.responseText = await res.text();
        if (this.upload.onprogress) this.upload.onprogress({ lengthComputable: true, loaded: 1, total: 1 });
        if (this.onload) this.onload();
      })
      .catch(() => this.onerror && this.onerror());
  }
};

import(pathToFileURL(path.join(here, 'tests.mjs')).href).catch((err) => {
  console.error(err);
  process.exit(1);
});
