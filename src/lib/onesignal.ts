// OneSignal Web Push integration (client-side)
// App ID is a public identifier, safe to ship in client code.
export const ONESIGNAL_APP_ID = "e487016f-71fb-4fea-aa65-4bc16b96538b";

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: any[];
  }
}

let initialized = false;

export function initOneSignal() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  // Inject SDK script
  if (!document.querySelector('script[data-onesignal-sdk]')) {
    const s = document.createElement("script");
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    s.setAttribute("data-onesignal-sdk", "true");
    document.head.appendChild(s);
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal: any) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: "/OneSignalSDKWorker.js",
        notifyButton: { enable: false },
      });
    } catch (e) {
      console.warn("[OneSignal] init failed", e);
    }
  });
}

export async function promptForPush(): Promise<boolean> {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        await OneSignal.Notifications.requestPermission();
        resolve(OneSignal.Notifications.permission === true);
      } catch {
        resolve(false);
      }
    });
  });
}

export async function getPushPermission(): Promise<"granted" | "denied" | "default" | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as any;
}

export async function setPushOptIn(optIn: boolean): Promise<void> {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        if (optIn) await OneSignal.User.PushSubscription.optIn();
        else await OneSignal.User.PushSubscription.optOut();
      } catch (e) {
        console.warn("[OneSignal] opt toggle failed", e);
      } finally {
        resolve();
      }
    });
  });
}

export async function getPushOptedIn(): Promise<boolean> {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      try {
        resolve(!!OneSignal.User?.PushSubscription?.optedIn);
      } catch {
        resolve(false);
      }
    });
  });
}
