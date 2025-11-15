import { ref, type Ref } from "vue";

// ==================== 類型定義 ====================

export interface ReferenceFocusOption {
  value: "face" | "scene";
  label: string;
}

export interface ReferenceBackup {
  preview: string;
  name: string;
  source: string;
  focus: string;
}

export interface ReferenceMetadata {
  referenceName: string;
  referenceFocus: string;
}

export interface StoredReferenceData {
  referenceName?: string;
  referenceFocus?: string;
}

export type SaveStateCallback = (metadata: ReferenceMetadata) => void;

export interface UseReferenceImageReturn {
  referencePreview: Ref<string>;
  referenceName: Ref<string>;
  referenceSource: Ref<string>;
  referenceFocus: Ref<string>;
  referenceInput: Ref<HTMLInputElement | null>;
  isCropperOpen: Ref<boolean>;
  referenceFocusOptions: ReferenceFocusOption[];
  handleReferenceTrigger: () => void;
  handleReferenceChange: (event: Event) => void;
  handleCropConfirm: (result: string | null, saveStateCallback?: SaveStateCallback) => void;
  handleCropCancel: () => void;
  reopenReferenceCropper: () => void;
  handleReferenceClear: (saveStateCallback?: SaveStateCallback) => void;
  loadReferenceFromStorage: (storedData: StoredReferenceData) => void;
}

// ==================== Composable ====================

export function useReferenceImage(): UseReferenceImageReturn {
  const referencePreview = ref<string>("");
  const referenceName = ref<string>("");
  const referenceSource = ref<string>("");
  const referenceFocus = ref<string>("face");
  const referenceInput = ref<HTMLInputElement | null>(null);
  const isCropperOpen = ref<boolean>(false);
  const pendingReferenceBackup = ref<ReferenceBackup | null>(null);

  const referenceFocusOptions: ReferenceFocusOption[] = [
    { value: "face", label: "參考臉部" },
    { value: "scene", label: "參考場景" },
  ];

  const handleReferenceTrigger = (): void => {
    referenceInput.value?.click();
  };

  const handleReferenceChange = (event: Event): void => {
    const target = event.target as HTMLInputElement;
    const [file] = Array.from(target?.files ?? []);
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (): void => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        return;
      }
      pendingReferenceBackup.value = {
        preview: referencePreview.value,
        name: referenceName.value,
        source: referenceSource.value,
        focus: referenceFocus.value,
      };
      referenceName.value = file.name ?? "";
      referenceSource.value = result;
      referenceFocus.value = "face";
      isCropperOpen.value = true;
    };
    reader.readAsDataURL(file);

    if (target) {
      target.value = "";
    }
  };

  const handleCropConfirm = (result: string | null, saveStateCallback?: SaveStateCallback): void => {
    isCropperOpen.value = false;
    if (!result) {
      handleCropCancel();
      return;
    }
    referencePreview.value = result;
    // 不要儲存大型 base64 圖片到 sessionStorage，只儲存元資料
    if (saveStateCallback) {
      saveStateCallback({
        referenceName: referenceName.value,
        referenceFocus: referenceFocus.value,
      });
    }
    pendingReferenceBackup.value = null;
  };

  const handleCropCancel = (): void => {
    isCropperOpen.value = false;
    if (pendingReferenceBackup.value) {
      referencePreview.value = pendingReferenceBackup.value.preview;
      referenceName.value = pendingReferenceBackup.value.name;
      referenceSource.value = pendingReferenceBackup.value.source;
      if (typeof pendingReferenceBackup.value.focus === "string") {
        referenceFocus.value = pendingReferenceBackup.value.focus;
      }
      pendingReferenceBackup.value = null;
    }
  };

  const reopenReferenceCropper = (): void => {
    if (!referenceSource.value) {
      return;
    }
    pendingReferenceBackup.value = {
      preview: referencePreview.value,
      name: referenceName.value,
      source: referenceSource.value,
      focus: referenceFocus.value,
    };
    isCropperOpen.value = true;
  };

  const handleReferenceClear = (saveStateCallback?: SaveStateCallback): void => {
    referencePreview.value = "";
    referenceName.value = "";
    referenceSource.value = "";
    referenceFocus.value = "face";
    pendingReferenceBackup.value = null;
    // 不要儲存大型 base64 圖片到 sessionStorage
    if (saveStateCallback) {
      saveStateCallback({
        referenceName: "",
        referenceFocus: "face",
      });
    }
  };

  const loadReferenceFromStorage = (storedData: StoredReferenceData): void => {
    // 不要從 sessionStorage 讀取大型 base64 圖片
    // referencePreview 和 referenceSource 只在記憶體中保留
    if (typeof storedData.referenceName === "string") {
      referenceName.value = storedData.referenceName;
    }
    if (
      typeof storedData.referenceFocus === "string" &&
      referenceFocusOptions.some(
        (option) => option.value === storedData.referenceFocus
      )
    ) {
      referenceFocus.value = storedData.referenceFocus;
    }
  };

  return {
    referencePreview,
    referenceName,
    referenceSource,
    referenceFocus,
    referenceInput,
    isCropperOpen,
    referenceFocusOptions,
    handleReferenceTrigger,
    handleReferenceChange,
    handleCropConfirm,
    handleCropCancel,
    reopenReferenceCropper,
    handleReferenceClear,
    loadReferenceFromStorage,
  };
}
