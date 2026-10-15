import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, LayoutAnimation, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// How far the on-screen keyboard covers the bottom of the view in `ref`, so the
// screen can pad itself and keep its input visible:
//   const overlap = useKeyboardOverlap(ref);  <View ref={ref} style={{ paddingBottom: overlap }}>
//
// The view is measured on the page each time the keyboard opens, so it works
// wherever the view sits and whether or not Android has already resized the
// window. On Android the keyboard's reported top edge is not reliable on every
// phone with edge-to-edge drawing, so its height (which Android reports without
// the navigation bar) is used too, and the higher of the two edges wins.
export function useKeyboardOverlap(ref) {
  const [overlap, setOverlap] = useState(0);
  const insets = useSafeAreaInsets();
  const navigationBar = useRef(insets.bottom);
  useEffect(() => {
    navigationBar.current = insets.bottom;
  });

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const animate = (event) => {
      const duration = event && event.duration;
      if (!duration) return;
      LayoutAnimation.configureNext({
        duration: Math.max(duration, 10),
        update: { duration: Math.max(duration, 10), type: LayoutAnimation.Types[event.easing] || 'keyboard' },
      });
    };
    const onShow = (event) => {
      const view = ref.current;
      const frame = event && event.endCoordinates;
      if (!view || !frame) return;
      let keyboardTop = frame.screenY;
      if (!ios) {
        const fromHeight = Dimensions.get('screen').height - (frame.height + navigationBar.current);
        keyboardTop = Math.min(keyboardTop, fromHeight);
      }
      view.measureInWindow((_x, y, _width, height) => {
        const next = Math.max(0, Math.round(y + height - keyboardTop));
        animate(event);
        setOverlap(next);
      });
    };
    const onHide = (event) => {
      animate(event);
      setOverlap(0);
    };

    const subscriptions = ios
      ? [Keyboard.addListener('keyboardWillShow', onShow), Keyboard.addListener('keyboardWillHide', onHide)]
      : [Keyboard.addListener('keyboardDidShow', onShow), Keyboard.addListener('keyboardDidHide', onHide)];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [ref]);

  return overlap;
}
