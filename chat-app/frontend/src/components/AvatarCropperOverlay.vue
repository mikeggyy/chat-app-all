<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";

interface Props {
  source: string;
  shape?: "circle" | "rounded-rect";
  aspectRatio?: number;
}

const props = withDefaults(defineProps<Props>(), {
  shape: "circle",
  aspectRatio: 1,
});

interface Emits {
  (e: "cancel"): void;
  (e: "confirm", result: string): void;
}

const emit = defineEmits<Emits>();

const cropContainerRef = ref<HTMLDivElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);

interface CropState {
  x: number;
  y: number;
  width: number;
  height: number;
}

const crop = reactive<CropState>({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
});

interface ImageMetrics {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  scaleX: number;
  scaleY: number;
}

const imageMetrics = reactive<ImageMetrics>({
  width: 0,
  height: 0,
  naturalWidth: 0,
  naturalHeight: 0,
  scaleX: 1,
  scaleY: 1,
});

interface SliderRange {
  min: number;
  max: number;
}

const sliderRange = reactive<SliderRange>({
  min: 120,
  max: 360,
});

const sliderValue = ref<number>(0);
const isDragging = ref<boolean>(false);

interface DragOffset {
  x: number;
  y: number;
}

const dragOffset = reactive<DragOffset>({ x: 0, y: 0 });

const isCircle = computed(() => props.shape === "circle");

const targetAspectRatio = computed(() => {
  if (isCircle.value) {
    return 1;
  }
  const ratio = Number(props.aspectRatio);
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return 3 / 4;
  }
  return ratio;
});

const cropOverlayStyle = computed(() => ({
  width: `${crop.width}px`,
  height: `${crop.height}px`,
  left: `${crop.x}px`,
  top: `${crop.y}px`,
}));

const overlayClasses = computed(() => ({
  "avatar-cropper__overlay--circle": isCircle.value,
  "avatar-cropper__overlay--rounded": !isCircle.value,
  "is-dragging": isDragging.value,
}));

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  const r = clamp(radius, 0, Math.min(width, height) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const resetCropState = (): void => {
  crop.x = 0;
  crop.y = 0;
  crop.width = 0;
  crop.height = 0;
  sliderRange.min = 120;
  sliderRange.max = 360;
  sliderValue.value = 0;
  imageMetrics.width = 0;
  imageMetrics.height = 0;
  imageMetrics.naturalWidth = 0;
  imageMetrics.naturalHeight = 0;
  imageMetrics.scaleX = 1;
  imageMetrics.scaleY = 1;
};

const detachDragListeners = (): void => {
  window.removeEventListener("pointermove", onDrag);
  window.removeEventListener("pointerup", stopDrag);
  window.removeEventListener("pointercancel", stopDrag);
};

const clampCropPosition = (): void => {
  if (!imageMetrics.width || !imageMetrics.height) return;
  const maxX = Math.max(0, imageMetrics.width - crop.width);
  const maxY = Math.max(0, imageMetrics.height - crop.height);
  crop.x = clamp(crop.x, 0, maxX);
  crop.y = clamp(crop.y, 0, maxY);
};

const updateSliderBounds = (): void => {
  if (!imageMetrics.width || !imageMetrics.height) return;

  const ratio = targetAspectRatio.value;

  let maxHeight;
  if (isCircle.value) {
    maxHeight = Math.min(imageMetrics.width, imageMetrics.height);
  } else {
    const widthLimitedHeight = imageMetrics.width / ratio;
    maxHeight = Math.min(imageMetrics.height, widthLimitedHeight);
  }

  if (!Number.isFinite(maxHeight) || maxHeight <= 0) {
    return;
  }

  sliderRange.max = Math.round(maxHeight);
  const preferredMin = Math.round(sliderRange.max * 0.35);
  const baselineMin = isCircle.value ? 120 : 160;
  sliderRange.min = clamp(preferredMin, baselineMin, sliderRange.max);
  if (sliderRange.min > sliderRange.max) {
    sliderRange.min = sliderRange.max;
  }

  const initialHeight = clamp(
    Math.round(sliderRange.max * 0.65),
    sliderRange.min,
    sliderRange.max
  );

  crop.height = initialHeight;
  crop.width = Math.round(initialHeight * ratio);

  if (crop.width > imageMetrics.width) {
    crop.width = imageMetrics.width;
    crop.height = Math.round(crop.width / ratio);
  }

  sliderValue.value = crop.height;
  crop.x = (imageMetrics.width - crop.width) / 2;
  crop.y = (imageMetrics.height - crop.height) / 2;
  clampCropPosition();
};

const onImageLoad = (
  event: Event | { target: HTMLImageElement | null }
): void => {
  const image = event?.target as HTMLImageElement | null;
  const container = cropContainerRef.value;
  if (!image || !container) return;
  const rect = container.getBoundingClientRect();
  imageMetrics.width = rect.width;
  imageMetrics.height = rect.height;
  imageMetrics.naturalWidth = image.naturalWidth || rect.width;
  imageMetrics.naturalHeight = image.naturalHeight || rect.height;
  imageMetrics.scaleX =
    rect.width > 0 ? imageMetrics.naturalWidth / rect.width : 1;
  imageMetrics.scaleY =
    rect.height > 0 ? imageMetrics.naturalHeight / rect.height : 1;
  updateSliderBounds();
};

const startDrag = (event: PointerEvent): void => {
  if (!crop.width || !crop.height) return;
  event.preventDefault();
  const container = cropContainerRef.value;
  if (!container) return;
  isDragging.value = true;
  const rect = container.getBoundingClientRect();
  dragOffset.x = event.clientX - rect.left - crop.x;
  dragOffset.y = event.clientY - rect.top - crop.y;
  window.addEventListener("pointermove", onDrag);
  window.addEventListener("pointerup", stopDrag);
  window.addEventListener("pointercancel", stopDrag);
};

const onDrag = (event: PointerEvent): void => {
  if (!isDragging.value) return;
  const container = cropContainerRef.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const nextX = event.clientX - rect.left - dragOffset.x;
  const nextY = event.clientY - rect.top - dragOffset.y;
  const maxX = Math.max(0, imageMetrics.width - crop.width);
  const maxY = Math.max(0, imageMetrics.height - crop.height);
  crop.x = clamp(nextX, 0, maxX);
  crop.y = clamp(nextY, 0, maxY);
};

const stopDrag = (): void => {
  if (!isDragging.value) return;
  isDragging.value = false;
  detachDragListeners();
};

const createCroppedImage = (): string | null => {
  const image = imageRef.value;
  if (!image || !crop.width || !crop.height) return null;

  const outputWidth = Math.max(1, Math.round(crop.width * imageMetrics.scaleX));
  const outputHeight = Math.max(
    1,
    Math.round(crop.height * imageMetrics.scaleY)
  );
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, outputWidth, outputHeight);
  ctx.save();
  if (isCircle.value) {
    ctx.beginPath();
    ctx.arc(outputWidth / 2, outputHeight / 2, outputWidth / 2, 0, Math.PI * 2);
    ctx.closePath();
  } else {
    drawRoundedRect(
      ctx,
      0,
      0,
      outputWidth,
      outputHeight,
      Math.round(Math.min(outputWidth, outputHeight) * 0.08)
    );
  }
  ctx.clip();

  const sourceX = Math.round(crop.x * imageMetrics.scaleX);
  const sourceY = Math.round(crop.y * imageMetrics.scaleY);
  const sourceWidth = Math.round(crop.width * imageMetrics.scaleX);
  const sourceHeight = Math.round(crop.height * imageMetrics.scaleY);
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );
  ctx.restore();
  return canvas.toDataURL("image/png");
};

const confirmCrop = (): void => {
  if (!crop.width || !crop.height) return;
  stopDrag();
  const result = createCroppedImage();
  if (result) {
    emit("confirm", result);
  }
};

const emitCancel = (): void => {
  stopDrag();
  emit("cancel");
};

const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    emitCancel();
  }
};

watch(
  () => props.source,
  () => {
    resetCropState();
    nextTick(() => {
      if (imageRef.value?.complete) {
        onImageLoad({ target: imageRef.value });
      }
    });
  },
  { immediate: true }
);

watch(
  () => sliderValue.value,
  (next) => {
    if (!crop.height && next === 0) return;
    const ratio = targetAspectRatio.value;
    let safeValue = clamp(Math.round(next), sliderRange.min, sliderRange.max);
    let nextHeight = safeValue;
    let nextWidth = Math.round(nextHeight * ratio);

    if (nextWidth > imageMetrics.width) {
      nextWidth = imageMetrics.width;
      nextHeight = Math.round(nextWidth / ratio);
      if (nextHeight !== safeValue) {
        sliderValue.value = nextHeight;
        return;
      }
    }

    crop.height = nextHeight;
    crop.width = nextWidth;
    clampCropPosition();
  }
);

onMounted(() => {
  document.addEventListener("keydown", handleKeydown);
  nextTick(() => {
    if (imageRef.value?.complete) {
      onImageLoad({ target: imageRef.value });
    }
  });
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
  detachDragListeners();
});
</script>

<template>
  <div class="avatar-cropper">
    <div class="avatar-cropper__panel" role="dialog" aria-modal="true">
      <header class="avatar-cropper__header">
        <div>
          <h2>調整頭像裁切</h2>
          <p>拖曳裁切區域至理想位置，並使用滑桿縮放範圍。</p>
        </div>
        <button
          type="button"
          class="avatar-cropper__close"
          aria-label="關閉裁切視窗"
          @click="emitCancel"
        >
          ×
        </button>
      </header>

      <div class="avatar-cropper__body">
        <div class="avatar-cropper__stage">
          <div class="avatar-cropper__canvas" ref="cropContainerRef">
            <img
              :src="source"
              alt="上傳圖片預覽"
              ref="imageRef"
              @load="onImageLoad"
            />

            <div
              v-if="crop.width && crop.height"
              class="avatar-cropper__overlay"
              :class="overlayClasses"
              :style="cropOverlayStyle"
              @pointerdown="startDrag"
            ></div>
          </div>
        </div>

        <div class="avatar-cropper__slider">
          <label for="avatar-cropper-range">裁切大小</label>
          <input
            id="avatar-cropper-range"
            type="range"
            :min="sliderRange.min"
            :max="sliderRange.max"
            v-model.number="sliderValue"
          />
        </div>
      </div>

      <footer class="avatar-cropper__footer">
        <button
          type="button"
          class="avatar-cropper__secondary"
          @click="emitCancel"
        >
          取消
        </button>
        <button
          type="button"
          class="avatar-cropper__primary"
          :disabled="!crop.width || !crop.height"
          @click="confirmCrop"
        >
          確認裁切
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped lang="scss">
.avatar-cropper {
  position: fixed;
  inset: 0;
  z-index: 1610;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 24, 0.82);
  backdrop-filter: blur(8px);
  padding: clamp(1rem, 3vw, 2.5rem);
  overflow-y: auto;
}

.avatar-cropper__panel {
  width: min(1080px, 100%);
  max-width: calc(100vw - 2rem);
  background: #101119;
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 28px 68px rgba(4, 6, 18, 0.6);
  display: flex;
  flex-direction: column;
  margin: auto;
}

.avatar-cropper__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.5rem 1.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  h2 {
    margin: 0;
    font-size: 1.3rem;
    letter-spacing: 0.08em;
    color: rgba(226, 232, 240, 0.7);
  }

  p {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    color: rgba(226, 232, 240, 0.7);
  }
}

.avatar-cropper__close {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 1.5rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 150ms ease, transform 150ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }
}

.avatar-cropper__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.75rem;
}

.avatar-cropper__stage {
  display: flex;
  justify-content: center;
  align-items: center;
}

.avatar-cropper__canvas {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(12, 13, 24, 0.9);
  border-radius: 28px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  overflow: hidden;
  max-width: min(760px, 90vw);
  max-height: min(70vh, 620px);
}

.avatar-cropper__canvas img {
  display: block;
  max-width: 100%;
  max-height: 70vh;
  height: auto;
  user-select: none;
  pointer-events: none;
}

.avatar-cropper__overlay {
  position: absolute;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.95);
  box-shadow: 0 0 0 9999px rgba(12, 14, 28, 0.55);
  background: rgba(255, 255, 255, 0.1);
  cursor: grab;
  transition: box-shadow 150ms ease;
  touch-action: none;

  &.is-dragging {
    cursor: grabbing;
    box-shadow: 0 0 0 9999px rgba(12, 14, 28, 0.68);
  }
}

.avatar-cropper__overlay--rounded {
  border-radius: 12px;
}

.avatar-cropper__overlay--circle {
  border-radius: 50%;
}

.avatar-cropper__slider {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: 420px;
  margin: 0 auto;

  label {
    font-size: 0.9rem;
    letter-spacing: 0.06em;
    color: rgba(241, 245, 249, 0.85);
  }

  input[type="range"] {
    width: 100%;
  }
}

.avatar-cropper__footer {
  display: flex;
  justify-content: center;
  gap: 0.85rem;
  padding: 1.5rem 1.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.avatar-cropper__secondary,
.avatar-cropper__primary {
  min-width: 120px;
  border-radius: 999px;
  padding: 0.65rem 1.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  border: none;
  transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
}

.avatar-cropper__secondary {
  background: rgba(255, 255, 255, 0.12);
  color: #f8fafc;
  box-shadow: 0 16px 32px rgba(8, 10, 24, 0.35);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 40px rgba(8, 10, 24, 0.45);
  }
}

.avatar-cropper__primary {
  background: linear-gradient(135deg, #ff4d8f, #ff7ab8);
  color: #fff;
  box-shadow: 0 20px 46px rgba(255, 77, 143, 0.45);

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 26px 58px rgba(255, 77, 143, 0.55);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
}

@media (max-width: 640px) {
  .avatar-cropper__panel {
    border-radius: 20px;
  }

  .avatar-cropper__header,
  .avatar-cropper__body,
  .avatar-cropper__footer {
    padding: 1.25rem;
  }

  .avatar-cropper__canvas {
    max-height: 60vh;
  }
}
</style>
