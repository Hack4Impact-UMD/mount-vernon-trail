import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
const noopSubscribe = () => () => {};

export function useColorScheme() {
  // false during static rendering and hydration, true on the client after it:
  // the no-effect way to detect hydration.
  const hasHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
