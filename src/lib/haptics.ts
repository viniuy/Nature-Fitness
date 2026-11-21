// Light tap feedback. Android uses the Vibration API. iPhone Safari has no
// vibration API, but toggling a native switch (iOS 18+) plays a system haptic,
// so a hidden switch is clicked through its label.
let label: HTMLLabelElement | null = null;

export function haptic() {
  try {
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(8); return; }
    if (!label) {
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute('switch', ''); input.id = 'nf-haptic';
      input.setAttribute('aria-hidden', 'true'); input.tabIndex = -1; input.style.display = 'none';
      label = document.createElement('label');
      label.htmlFor = 'nf-haptic'; label.setAttribute('aria-hidden', 'true'); label.style.display = 'none';
      document.body.append(input, label);
    }
    label.click();
  } catch { /* no haptics here */ }
}
