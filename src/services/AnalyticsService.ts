import * as Network from "expo-network";
import PostHog from "posthog-react-native";
import { createMMKV } from "react-native-mmkv";
// 1. Initialize MMKV
const storage = createMMKV({
  id: "sentinel-analytics-storage",
});

// 2. Create Custom Storage Adapter for PostHog
const mmkvPersistence = {
  getItem: async (key: string) => {
    const res = storage.getString(key);
    return res || null;
  },
  setItem: async (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: async (key: string) => {
    storage.remove(key);
  },
};

// 3. Initialize PostHog Client safely
const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const API_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

if (!API_KEY) {
  console.warn("⚠️ PostHog API Key not found. Analytics will be disabled.");
}

export const posthog = API_KEY
  ? new PostHog(API_KEY, {
    host: API_HOST,
    persistence: "file", // Use MMKV directly
    customStorage: mmkvPersistence,
    flushAt: 20,
    flushInterval: 30,
    captureAppLifecycleEvents: true,
  })
  : null;

/**
 * Wrapper Service to maintain compatibility with the rest of the app
 * and implement "Safe Flushing" logic.
 */
class AnalyticsService {
  /**
   * Track an event with properties.
   * Data is instantly saved to MMKV via the adapter.
   */
  track(name: string, properties: Record<string, any> = {}) {
    if (!posthog) return;
    posthog.capture(name, properties);
  }

  /**
   * Smart Flush: Only sends data if:
   * 1. We have a good connection (WiFi preferred for large batches)
   * 2. The app is not in a critical "Emergency Mode" (logic can be extended)
   */
  async flush() {
    if (!posthog) return;

    const state = await Network.getNetworkStateAsync();

    // Check for internet connection
    if (state.isInternetReachable) {
      // Optional: Only flush on WiFi if data saving is a concern
      // if (state.type === Network.NetworkStateType.WIFI) { ... }

      console.log("🚀 Analytics: Attempting safe flush...");
      await posthog.flush();
    } else {
      console.log("⚠️ Analytics: Offline. Events kept in MMKV.");
    }
  }

  /**
   * Identify the user (e.g., after login)
   */
  identify(userId: string, userProperties?: Record<string, any>) {
    if (!posthog) return;
    posthog.identify(userId, userProperties);
  }

  /**
   * Reset tracking (e.g., on logout)
   */
  reset() {
    if (!posthog) return;
    posthog.reset();
  }
}

export const Analytics = new AnalyticsService();
