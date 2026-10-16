import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Directory, File, Paths } from 'expo-file-system';
import { Button, Text } from '@/components/ui';
import { ApiError } from '@/services/api';
import { POSTER_RENDERER_URL } from '@/services/config';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { POSTER_HEIGHT, POSTER_WIDTH, TEMPLATES } from './model';

// The poster is drawn by the website's own templates: this WebView opens the
// website's /poster-renderer page, which renders the poster the app sends it
// (preview) and paints the PNG / PDF with the website's export code. So a
// poster looks the same — and exports the same file — on the website and in
// the app. The page never calls the API: the app sends it the poster data it
// loaded with the doctor's token, and the finished file comes back here.
//
// Bridge messages: see frontend/src/components/posters/PosterRenderer.jsx.

const BRIDGE_VERSION = 1;
const READY_TIMEOUT_MS = 45000; // the page itself (first load can be slow on mobile data)
const EXPORT_TIMEOUT_MS = 120000;
const PREVIEW_DEBOUNCE_MS = 350;

const rendererOrigin = (() => {
  const match = /^(https?:\/\/[^/]+)/i.exec(POSTER_RENDERER_URL);
  return match ? match[1].toLowerCase() : '';
})();

let requestCounter = 0;

function exportFolder() {
  const folder = new Directory(Paths.cache, 'posters');
  folder.create({ idempotent: true, intermediates: true });
  return folder;
}

/**
 *   <PosterRenderer ref={renderer} form={form} onFit={setFit} />
 *   const file = await renderer.current.exportFile({ form, format: 'png', title, onPhase });
 *   → { uri, filename, mimeType, bytes, width, height }
 *
 * `form` (editor form shape) is previewed; pass null to use the renderer for
 * exports only. The view keeps the poster's proportions at the given width.
 */
export function PosterRenderer({ ref, form, onFit, onStateChange, style, label = 'Poster preview' }) {
  const { colors } = useTheme();
  const web = useRef(null);
  const [state, setState] = useState(POSTER_RENDERER_URL ? 'loading' : 'error'); // loading | ready | previewed | error
  const [error, setError] = useState(POSTER_RENDERER_URL ? '' : 'The website address is not configured in this build.');
  const [width, setWidth] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const ready = useRef(false);
  const jobs = useRef(new Map());
  const formRef = useRef(form);
  const callbacks = useRef({ onFit, onStateChange });
  useEffect(() => {
    callbacks.current = { onFit, onStateChange };
  });

  const changeState = useCallback((next, message = '') => {
    setState(next);
    setError(message);
    if (callbacks.current.onStateChange) callbacks.current.onStateChange(next, message);
  }, []);

  const send = useCallback((message) => {
    if (!web.current || !ready.current) return false;
    web.current.injectJavaScript(`window.mkcgPosterBridge && window.mkcgPosterBridge.receive(${JSON.stringify(message)}); true;`);
    return true;
  }, []);

  const failJobs = useCallback((message) => {
    for (const job of jobs.current.values()) {
      clearTimeout(job.timer);
      job.reject(new ApiError({ code: 'RENDER_FAILED', message }));
    }
    jobs.current.clear();
  }, []);

  // The page has to answer within a reasonable time.
  useEffect(() => {
    if (!POSTER_RENDERER_URL) return undefined;
    ready.current = false;
    const timer = setTimeout(() => {
      if (!ready.current) changeState('error', 'The poster designer could not be opened. Check your connection and try again.');
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [attempt, changeState]);

  useEffect(() => () => failJobs('The poster designer was closed.'), [failJobs]);

  // Live preview: the latest form, a moment after the last change.
  useEffect(() => {
    formRef.current = form;
    if (!form || !ready.current) return undefined;
    const timer = setTimeout(() => send({ type: 'preview', form }), PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form, send, state]);

  const onMessage = useCallback(
    (event) => {
      let message;
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (!message || typeof message !== 'object') return;
      const job = message.requestId ? jobs.current.get(message.requestId) : null;

      switch (message.type) {
        case 'ready': {
          const known = Array.isArray(message.templates) ? message.templates : [];
          if (message.version !== BRIDGE_VERSION || TEMPLATES.some((t) => !known.includes(t.id))) {
            changeState('error', 'The poster designer on the website is a different version. Please update the app, or try again later.');
            return;
          }
          ready.current = true;
          changeState('ready');
          if (formRef.current) send({ type: 'preview', form: formRef.current });
          break;
        }
        case 'fit':
          if (callbacks.current.onFit) callbacks.current.onFit({ overflow: Boolean(message.overflow), message: message.message || '' });
          break;
        case 'previewed':
          changeState('previewed', message.failedImages ? 'A photo on the poster could not be loaded.' : '');
          break;
        case 'export-phase':
          if (job && job.onPhase) job.onPhase(message.phase);
          break;
        case 'file-start': {
          if (!job) return;
          try {
            const file = new File(exportFolder(), String(message.filename || 'batch-poster').replace(/[^\w.-]+/g, '-'));
            if (file.exists) file.delete();
            file.create();
            Object.assign(job, { file, meta: message, received: 0 });
          } catch {
            jobs.current.delete(message.requestId);
            clearTimeout(job.timer);
            job.reject(new ApiError({ code: 'SAVE_FAILED', message: 'There is not enough space on this phone to prepare the file.' }));
          }
          break;
        }
        case 'file-chunk':
          if (!job || !job.file) return;
          if (message.index !== job.received) {
            jobs.current.delete(message.requestId);
            clearTimeout(job.timer);
            job.reject(new ApiError({ code: 'RENDER_FAILED', message: 'The file arrived incomplete. Please try again.' }));
            return;
          }
          job.file.write(message.data, { encoding: 'base64', append: true });
          job.received += 1;
          if (job.onPhase) job.onPhase('receiving', job.received / job.meta.chunks);
          break;
        case 'file-end': {
          if (!job || !job.file) return;
          jobs.current.delete(message.requestId);
          clearTimeout(job.timer);
          const { meta, file } = job;
          if (job.received !== meta.chunks || (meta.bytes && file.size !== meta.bytes)) {
            job.reject(new ApiError({ code: 'RENDER_FAILED', message: 'The file arrived incomplete. Please try again.' }));
            return;
          }
          job.resolve({ uri: file.uri, file, filename: file.name, mimeType: meta.mimeType, bytes: file.size, width: meta.width, height: meta.height });
          break;
        }
        case 'error':
          if (job) {
            jobs.current.delete(message.requestId);
            clearTimeout(job.timer);
            job.reject(new ApiError({ code: 'RENDER_FAILED', message: message.message || 'The poster could not be exported.' }));
          } else {
            changeState('error', message.message || 'The poster could not be drawn.');
          }
          break;
        default:
      }
    },
    [changeState, send]
  );

  useImperativeHandle(
    ref,
    () => ({
      exportFile: ({ form: data, format, title, onPhase }) =>
        new Promise((resolve, reject) => {
          if (!ready.current) {
            reject(new ApiError({ code: 'RENDER_UNAVAILABLE', message: 'The poster designer is still loading. Please try again in a moment.' }));
            return;
          }
          requestCounter += 1;
          const requestId = `export-${Date.now()}-${requestCounter}`;
          const timer = setTimeout(() => {
            jobs.current.delete(requestId);
            reject(new ApiError({ code: 'RENDER_TIMEOUT', message: 'Preparing the file took too long. Please try again.' }));
          }, EXPORT_TIMEOUT_MS);
          jobs.current.set(requestId, { resolve, reject, onPhase, timer });
          send({ type: 'export', requestId, form: data, format, title });
        }),
      reload: () => {
        failJobs('The poster designer was reloaded.');
        ready.current = false;
        changeState('loading');
        setAttempt((n) => n + 1);
      },
    }),
    [send, failJobs, changeState]
  );

  // Only the renderer page itself may load here; any other link is refused.
  const allowNavigation = useCallback((request) => {
    const url = String(request.url || '').toLowerCase();
    return url === 'about:blank' || (rendererOrigin && url.startsWith(rendererOrigin));
  }, []);

  const height = width ? Math.round((width * POSTER_HEIGHT) / POSTER_WIDTH) : undefined;

  return (
    <View
      style={[styles.frame, { backgroundColor: colors.surface2, borderColor: colors.line, height, aspectRatio: width ? undefined : POSTER_WIDTH / POSTER_HEIGHT }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={label}
    >
      {POSTER_RENDERER_URL && state !== 'error' ? (
        <WebView
          key={attempt}
          ref={web}
          source={{ uri: POSTER_RENDERER_URL }}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={allowNavigation}
          onError={() => changeState('error', 'The poster designer could not be opened. Check your connection and try again.')}
          onHttpError={(e) =>
            changeState(
              'error',
              e.nativeEvent.statusCode === 404
                ? 'The poster designer is not available on the website yet.'
                : 'The poster designer could not be opened. Please try again later.'
            )
          }
          onContentProcessDidTerminate={() => changeState('error', 'The poster designer stopped. Please try again.')}
          onRenderProcessGone={() => changeState('error', 'The poster designer stopped. Please try again.')}
          originWhitelist={['http://*', 'https://*']}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="never"
          textZoom={100}
          setBuiltInZoomControls
          setDisplayZoomControls={false}
          overScrollMode="never"
          style={styles.web}
          containerStyle={styles.web}
        />
      ) : null}
      {state === 'loading' || state === 'ready' ? (
        <View style={[styles.overlay, { backgroundColor: colors.surface2 }]} pointerEvents="none">
          <ActivityIndicator color={colors.brand} />
          <Text variant="caption" tone="muted">
            {state === 'loading' ? 'Opening the poster designer…' : form ? 'Drawing your poster…' : 'Ready'}
          </Text>
        </View>
      ) : null}
      {state === 'error' ? (
        <View style={[styles.overlay, { backgroundColor: colors.surface2 }]}>
          <Text variant="smallStrong" center>
            {error}
          </Text>
          {POSTER_RENDERER_URL ? (
            <Button
              title="Try again"
              size="sm"
              variant="secondary"
              icon="refresh"
              onPress={() => {
                failJobs('The poster designer was reloaded.');
                changeState('loading');
                setAttempt((n) => n + 1);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  web: { flex: 1, backgroundColor: 'transparent' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
});
