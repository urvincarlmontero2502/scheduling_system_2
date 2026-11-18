const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
let scriptPromise;

function loadRecaptcha() {
  if (!siteKey) {
    return Promise.reject(
      new Error("reCAPTCHA is not configured. Please contact the system administrator."),
    );
  }

  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.grecaptcha?.execute) {
        resolve(window.grecaptcha);
      } else {
        scriptPromise = null;
        reject(new Error("Could not initialize reCAPTCHA. Please try again."));
      }
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load reCAPTCHA. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function executeLoginRecaptcha() {
  const recaptcha = await loadRecaptcha();
  await new Promise((resolve) => recaptcha.ready(resolve));
  return recaptcha.execute(siteKey, { action: "login" });
}
