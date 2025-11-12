import { ref } from "vue";

export function useReferenceImage() {
  const referencePreview = ref("");
  const referenceName = ref("");
  const referenceSource = ref("");
  const referenceFocus = ref("face");
  const referenceInput = ref(null);
  const isCropperOpen = ref(false);
  const pendingReferenceBackup = ref(null);

  const referenceFocusOptions = [
    { value: "face", label: "參考臉部" },
    { value: "scene", label: "參考場景" },
  ];

  const handleReferenceTrigger = () => {
    referenceInput.value?.click();
  };

  const handleReferenceChange = (event) => {
    const [file] = Array.from(event.target?.files ?? []);
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
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

    if (event.target) {
      event.target.value = "";
    }
  };

  const handleCropConfirm = (result, saveStateCallback) => {
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

  const handleCropCancel = () => {
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

  const reopenReferenceCropper = () => {
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

  const handleReferenceClear = (saveStateCallback) => {
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

  const loadReferenceFromStorage = (storedData) => {
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
