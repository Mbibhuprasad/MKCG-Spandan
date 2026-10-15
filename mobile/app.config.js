// Expo app configuration. Nothing here is secret: the only environment value
// the app reads is the public address of the MKCGSPANDAN API.
//
//   EXPO_PUBLIC_API_URL   e.g. https://api.example.com  (see .env.example)
//
// Plain http:// is only allowed by Android when the configured API address is
// not https — that is, for local development. A production build pointed at an
// https:// API ships with cleartext traffic switched off.
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || "").trim();
const allowCleartext = !apiUrl.startsWith("https://");

module.exports = {
  expo: {
    name: "MKCGSPANDAN",
    slug: "mkcgspandan",
    scheme: "mkcgspandan",
    version: "1.0.0",
    orientation: "portrait",
    extra: {
      eas: {
        projectId: "bcd131ba-391b-43fe-b763-cdc1dd8a6284",
      },
    },
    icon: "./assets/icon.png",
    // The app has its own light/dark switch (light by default); this only lets
    // system surfaces such as dialogs follow whichever theme is active.
    userInterfaceStyle: "automatic",
    android: {
      package: "com.mkcgspandan.app",
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: "#ffffff",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      softwareKeyboardLayoutMode: "resize",
      // Voice and video calls are not part of the app yet, so the camera and
      // microphone are never requested (media is chosen from the gallery).
      blockedPermissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
      ],
    },
    plugins: [
      "expo-router",
      "expo-secure-store",
      "expo-video",
      [
        "expo-splash-screen",
        {
          // The MKCGSPANDAN logo (artwork on white), centred; the animated
          // launch screen in components/BootScreens.js takes over from it.
          image: "./assets/MKCGSPANDAN LOGO.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            image: "./assets/MKCGSPANDAN LOGO.png",
            backgroundColor: "#090c11",
          },
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "MKCGSPANDAN needs access to your photos so you can add a profile photo, memories and cover images.",
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      ["expo-notifications", { color: "#14398a" }],
      [
        "expo-build-properties",
        { android: { usesCleartextTraffic: allowCleartext } },
      ],
    ],
    experiments: { typedRoutes: false },
  },
};
