const DRAG_ATTRIBUTE = "data-drag-scroll";
const DRAG_STATE_READY = "ready";
const DRAG_STATE_DRAGGING = "dragging";
const DRAG_START_THRESHOLD = 6;
const CLICK_BLOCK_INTERVAL = 400;

const pointerState = {
  pointerId: null,
  element: null,
  startX: 0,
  startY: 0,
  startScrollLeft: 0,
  isDragging: false,
  pointerType: null,
  lastScrollLeft: 0,
  lastMoveTime: 0,
  velocity: 0,
};

const lastDrag = {
  element: null,
  timestamp: 0,
};

let momentumFrameId = null;
let momentumElement = null;
let momentumVelocity = 0;
let momentumLastTime = 0;

const MOMENTUM_DECAY = 0.92;
const MOMENTUM_MIN_VELOCITY = 0.02;

let isEnabled = false;

const pointerMoveListenerOptions = { passive: false };

const scrollableOverflowValues = new Set(["auto", "scroll", "overlay"]);

const isElementHorizontallyScrollable = (element) => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.hasAttribute("data-drag-scroll-disabled")) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (!scrollableOverflowValues.has(style.overflowX)) {
    return false;
  }

  return element.scrollWidth - element.clientWidth > 1;
};

const findScrollableAncestor = (target) => {
  if (!(target instanceof Element)) {
    return null;
  }

  let node = target;
  while (node && node !== document.body) {
    if (isElementHorizontallyScrollable(node)) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
};

const setDragState = (element, state) => {
  if (!element || !(element instanceof HTMLElement)) {
    return;
  }
  element.setAttribute(DRAG_ATTRIBUTE, state);
};

const cancelMomentum = (element) => {
  if (
    momentumFrameId !== null &&
    (!element || (momentumElement && momentumElement === element))
  ) {
    cancelAnimationFrame(momentumFrameId);
    momentumFrameId = null;
    momentumElement = null;
    momentumVelocity = 0;
    momentumLastTime = 0;
  }
};

const startMomentum = (element, initialVelocity) => {
  if (
    !(element instanceof HTMLElement) ||
    element.scrollWidth <= element.clientWidth
  ) {
    return;
  }

  if (Math.abs(initialVelocity) < MOMENTUM_MIN_VELOCITY) {
    return;
  }

  cancelMomentum();

  momentumElement = element;
  momentumVelocity = initialVelocity;
  momentumLastTime = performance.now();

  const step = () => {
    if (
      !momentumElement ||
      !momentumElement.isConnected ||
      momentumElement.scrollWidth <= momentumElement.clientWidth
    ) {
      cancelMomentum();
      return;
    }

    const now = performance.now();
    const elapsed = Math.max(Math.min(now - momentumLastTime, 48), 0);
    momentumLastTime = now;

    const distance = momentumVelocity * elapsed;
    if (distance !== 0) {
      const previousScrollLeft = momentumElement.scrollLeft;
      momentumElement.scrollLeft += distance;
      if (momentumElement.scrollLeft === previousScrollLeft) {
        cancelMomentum();
        return;
      }
    }

    const decayFactor =
      elapsed > 0 ? Math.pow(MOMENTUM_DECAY, elapsed / 16.67) : MOMENTUM_DECAY;
    momentumVelocity *= decayFactor;

    if (Math.abs(momentumVelocity) < MOMENTUM_MIN_VELOCITY) {
      cancelMomentum();
      return;
    }

    momentumFrameId = requestAnimationFrame(step);
  };

  momentumFrameId = requestAnimationFrame(step);
};

const resetPointerState = () => {
  pointerState.pointerId = null;
  pointerState.element = null;
  pointerState.startX = 0;
  pointerState.startY = 0;
  pointerState.startScrollLeft = 0;
  pointerState.isDragging = false;
  pointerState.pointerType = null;
  pointerState.lastScrollLeft = 0;
  pointerState.lastMoveTime = 0;
  pointerState.velocity = 0;

  window.removeEventListener("pointermove", onPointerMove, pointerMoveListenerOptions);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);
};

const onPointerMove = (event) => {
  if (event.pointerId !== pointerState.pointerId || !pointerState.element) {
    return;
  }

  const now = performance.now();
  const deltaX = event.clientX - pointerState.startX;
  const deltaY = event.clientY - pointerState.startY;

  if (!pointerState.isDragging) {
    if (Math.abs(deltaX) < DRAG_START_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    pointerState.isDragging = true;
    setDragState(pointerState.element, DRAG_STATE_DRAGGING);
    pointerState.lastScrollLeft = pointerState.element.scrollLeft;
    pointerState.lastMoveTime = now;
    pointerState.velocity = 0;
  }

  event.preventDefault();
  const target = pointerState.element;
  const previousScrollLeft = target.scrollLeft;
  const nextScrollLeft = pointerState.startScrollLeft - deltaX;

  if (nextScrollLeft !== previousScrollLeft) {
    target.scrollLeft = nextScrollLeft;
    const deltaScroll = target.scrollLeft - pointerState.lastScrollLeft;
    const elapsed = pointerState.lastMoveTime
      ? Math.max(now - pointerState.lastMoveTime, 0)
      : 0;

    if (elapsed > 0) {
      pointerState.velocity = deltaScroll / elapsed;
    } else {
      pointerState.velocity = 0;
    }

    pointerState.lastScrollLeft = target.scrollLeft;
    pointerState.lastMoveTime = now;
  } else {
    pointerState.velocity = 0;
    pointerState.lastMoveTime = now;
  }
};

const onPointerUp = (event) => {
  if (event.pointerId !== pointerState.pointerId) {
    return;
  }

  const targetElement = pointerState.element;
  const wasDragging = pointerState.isDragging;
  const releaseVelocity = pointerState.velocity;

  if (targetElement && targetElement.isConnected) {
    setDragState(targetElement, DRAG_STATE_READY);
    if (typeof targetElement.releasePointerCapture === "function") {
      try {
        targetElement.releasePointerCapture(event.pointerId);
      } catch (error) {
        // ignore if releasePointerCapture is not allowed
      }
    }
  }

  resetPointerState();

  if (wasDragging && targetElement) {
    lastDrag.element = targetElement;
    lastDrag.timestamp = Date.now();

    if (Math.abs(releaseVelocity) >= MOMENTUM_MIN_VELOCITY) {
      startMomentum(targetElement, releaseVelocity);
    }
  }
};

const onPointerDown = (event) => {
  if (
    event.pointerId === pointerState.pointerId ||
    !event.isPrimary ||
    (event.pointerType === "mouse" && event.button !== 0)
  ) {
    return;
  }

  const scrollableElement = findScrollableAncestor(event.target);
  if (!scrollableElement) {
    return;
  }

  cancelMomentum(scrollableElement);

  pointerState.pointerId = event.pointerId;
  pointerState.element = scrollableElement;
  pointerState.startX = event.clientX;
  pointerState.startY = event.clientY;
  pointerState.startScrollLeft = scrollableElement.scrollLeft;
  pointerState.isDragging = false;
  pointerState.pointerType = event.pointerType;
  pointerState.lastScrollLeft = scrollableElement.scrollLeft;
  pointerState.lastMoveTime = performance.now();
  pointerState.velocity = 0;

  setDragState(scrollableElement, DRAG_STATE_READY);

  try {
    scrollableElement.setPointerCapture(event.pointerId);
  } catch (error) {
    // Some elements do not support setPointerCapture (e.g., SVG); ignore errors.
  }

  window.addEventListener("pointermove", onPointerMove, pointerMoveListenerOptions);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
};

const onClickCapture = (event) => {
  if (!lastDrag.element) {
    return;
  }

  if (Date.now() - lastDrag.timestamp > CLICK_BLOCK_INTERVAL) {
    lastDrag.element = null;
    lastDrag.timestamp = 0;
    return;
  }

  if (!(event.target instanceof Node)) {
    return;
  }

  if (lastDrag.element.contains(event.target)) {
    event.preventDefault();
    event.stopPropagation();
    lastDrag.element = null;
    lastDrag.timestamp = 0;
  }
};

const onDragStart = (event) => {
  if (!(event.target instanceof Element)) {
    return;
  }

  const scrollableElement = findScrollableAncestor(event.target);
  if (scrollableElement) {
    event.preventDefault();
  }
};

export const enableHorizontalDragScroll = () => {
  if (isEnabled || typeof window === "undefined") {
    return;
  }

  isEnabled = true;

  const pointerDownTargets = [window, document];
  for (const target of pointerDownTargets) {
    target.addEventListener("pointerdown", onPointerDown, { capture: true });
    target.addEventListener("click", onClickCapture, true);
    target.addEventListener("dragstart", onDragStart, true);
  }
};
