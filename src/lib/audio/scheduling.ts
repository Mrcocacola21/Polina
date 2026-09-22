export function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampVolume(value: number): number {
  return clamp(value, 0, 1);
}

export function clampGain(value: number): number {
  return clamp(value, 0, 2);
}

export function clampPan(value: number): number {
  return clamp(value, -1, 1);
}

export function clampPlaybackRate(value: number): number {
  return clamp(value, 0.5, 2);
}

export function holdParam(param: AudioParam, atTime: number): void {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(atTime);
    return;
  }

  const currentValue = param.value;
  param.cancelScheduledValues(atTime);
  param.setValueAtTime(currentValue, atTime);
}

export function setParamSmooth(
  param: AudioParam,
  value: number,
  context: BaseAudioContext,
  rampSeconds = 0.03,
): void {
  const now = context.currentTime;
  const duration = Math.max(0, rampSeconds);
  holdParam(param, now);

  if (duration === 0) {
    param.setValueAtTime(value, now);
  } else {
    param.linearRampToValueAtTime(value, now + duration);
  }
}

export function rampGain(
  gain: GainNode,
  value: number,
  context: BaseAudioContext,
  rampSeconds = 0.03,
): void {
  setParamSmooth(gain.gain, Math.max(0, value), context, rampSeconds);
}
