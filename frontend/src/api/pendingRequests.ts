const listeners = new Set<() => void>();
let pending = 0;

export function subscribeToPendingRequests(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hasPendingRequests() {
  return pending > 0;
}

export function beginRequest() {
  pending += 1;
  if (pending === 1) listeners.forEach((listener) => listener());
  return () => {
    pending -= 1;
    if (pending === 0) listeners.forEach((listener) => listener());
  };
}
