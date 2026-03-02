let storeAmbientContext: AudioContext | null = null;
let storeAmbientInterval: ReturnType<typeof setInterval> | null = null;

function canUseAudio() {
  return typeof window !== "undefined" && typeof AudioContext !== "undefined";
}

function createEnvelope(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration = 1.2,
  gain = 0.05,
  wave: OscillatorType = "sine"
) {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.12);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.05);
}

export function playCozyNotificationSound() {
  if (!canUseAudio()) return;
  try {
    const notifRaw = localStorage.getItem("lingua-notifications");
    if (notifRaw) {
      const notifSettings = JSON.parse(notifRaw);
      if (notifSettings.soundEnabled === false) return;
    }

    const context = new AudioContext();
    const now = context.currentTime + 0.01;

    createEnvelope(context, 523.25, now, 0.28, 0.03);
    createEnvelope(context, 659.25, now + 0.12, 0.34, 0.024);

    window.setTimeout(() => {
      context.close().catch(() => {});
    }, 900);
  } catch {
    // no-op
  }
}

export function startStoreCozyAmbience() {
  if (!canUseAudio()) {
    return () => {};
  }

  if (!storeAmbientContext) {
    storeAmbientContext = new AudioContext();
  }

  const context = storeAmbientContext;
  if (context.state === "suspended") {
    context.resume().catch(() => {});
  }

  const playCozyChord = (
    rootHz: number,
    startAt: number,
    chordGain = 0.012,
    padDuration = 5.2
  ) => {
    createEnvelope(context, rootHz, startAt, padDuration, chordGain, "triangle");
    createEnvelope(context, rootHz * (5 / 4), startAt + 0.08, padDuration - 0.3, chordGain * 0.86, "sine");
    createEnvelope(context, rootHz * (3 / 2), startAt + 0.16, padDuration - 0.6, chordGain * 0.78, "sine");
    createEnvelope(context, rootHz * 2, startAt + 0.22, padDuration - 1.2, chordGain * 0.55, "triangle");
  };

  const playCozyBell = (frequency: number, startAt: number) => {
    createEnvelope(context, frequency, startAt, 1.6, 0.006, "sine");
    createEnvelope(context, frequency * 2, startAt + 0.04, 1.2, 0.0036, "sine");
  };

  const playLayer = () => {
    const now = context.currentTime + 0.01;

    // Two-bar cozy progression (G major → D major-ish color)
    playCozyChord(196.0, now, 0.0125, 5.4);
    playCozyBell(783.99, now + 1.2);
    playCozyBell(659.25, now + 2.4);

    playCozyChord(146.83, now + 4.6, 0.0115, 5.1);
    playCozyBell(587.33, now + 6.1);
    playCozyBell(739.99, now + 7.4);

    // Warm bass pulse for richness
    createEnvelope(context, 98.0, now + 0.08, 3.3, 0.006, "triangle");
    createEnvelope(context, 73.42, now + 4.72, 3.0, 0.0055, "triangle");
  };

  playLayer();
  if (storeAmbientInterval) clearInterval(storeAmbientInterval);
  storeAmbientInterval = setInterval(playLayer, 9400);

  return () => {
    if (storeAmbientInterval) {
      clearInterval(storeAmbientInterval);
      storeAmbientInterval = null;
    }
    if (storeAmbientContext) {
      storeAmbientContext.close().catch(() => {});
      storeAmbientContext = null;
    }
  };
}
