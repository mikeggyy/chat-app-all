<script setup>
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/vue/24/outline";
import { HeartIcon, ChatBubbleLeftRightIcon } from "@heroicons/vue/24/solid";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  panelType: {
    type: String,
    default: "reconnect",
  },
  heroImage: {
    type: String,
    default: "/banner/reconnect-hero.webp",
  },
  badgeLabel: {
    type: String,
    default: "重新連線",
  },
  badgeIcon: {
    type: Object,
    default: () => HeartIcon,
  },
  description: {
    type: String,
    default: "",
  },
  records: {
    type: Array,
    default: () => [],
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close", "scroll", "entry-click"]);

const handleClose = () => {
  emit("close");
};

const handleScroll = (event) => {
  emit("scroll", event);
};

const handleEntryClick = (entry) => {
  emit("entry-click", entry);
};
</script>

<template>
  <div
    v-if="isOpen"
    class="recent-records-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="recent-records-badge"
    aria-describedby="recent-records-description"
  >
    <div
      class="recent-records-overlay__backdrop"
      @click="handleClose"
      aria-hidden="true"
    ></div>

    <section class="recent-records-panel">
      <header class="recent-records-hero">
        <button
          type="button"
          class="recent-records-close"
          @click="handleClose"
          aria-label="返回上一頁"
        >
          <ArrowLeftIcon aria-hidden="true" />
        </button>

        <div class="recent-records-hero__media" aria-hidden="true">
          <img :src="heroImage" alt="" loading="lazy" />
        </div>

        <div class="recent-records-hero__content">
          <div class="recent-records-hero__badge">
            <div class="recent-records-hero__badge-icon">
              <component :is="badgeIcon" aria-hidden="true" />
            </div>
            <span id="recent-records-badge" class="recent-records-hero__badge-label">
              {{ badgeLabel }}
            </span>
          </div>
          <div class="recent-records-hero__text">
            <p id="recent-records-description">{{ description }}</p>
          </div>
        </div>
      </header>

      <div class="recent-records-list" @scroll="handleScroll">
        <article
          v-for="entry in records"
          :key="entry.id"
          class="recent-record-card"
        >
          <div class="recent-record-card__media">
            <div class="recent-record-card__media-frame">
              <img :src="entry.image" :alt="entry.name" />
            </div>
          </div>
          <div class="recent-record-card__body">
            <header class="recent-record-card__header">
              <div class="recent-record-card__heading">
                <h3 class="recent-record-card__name">{{ entry.name }}</h3>
                <p v-if="entry.tagline" class="recent-record-card__tagline">
                  {{ entry.tagline }}
                </p>
              </div>
              <div class="recent-record-card__meta">
                <ul
                  v-if="entry.metrics && entry.metrics.length"
                  class="recent-record-card__metrics"
                >
                  <li
                    v-for="stat in entry.metrics"
                    :key="stat.key"
                    class="recent-record-card__metric"
                  >
                    <component
                      :is="stat.icon"
                      class="recent-record-card__metric-icon"
                      aria-hidden="true"
                    />
                    <span class="recent-record-card__metric-value">
                      {{ stat.value }}
                    </span>
                  </li>
                </ul>
                <button
                  type="button"
                  class="recent-record-card__arrow"
                  :aria-label="`與 ${entry.name} 開啟對話`"
                  @click="handleEntryClick(entry)"
                >
                  <ArrowRightIcon />
                </button>
              </div>
            </header>
            <p class="recent-record-card__description">{{ entry.description }}</p>
          </div>
        </article>

        <!-- 加載指示器 -->
        <div v-if="isLoading" class="records-loading">
          <div class="records-loading-spinner"></div>
          <p>載入更多...</p>
        </div>

        <!-- 已全部載入提示 -->
        <div v-else-if="!hasMore && records.length > 0" class="records-end">
          <p v-if="panelType === 'ranking'">
            已顯示全部 {{ records.length }} 個角色
          </p>
          <p v-else>已顯示全部 {{ records.length }} 則對話記錄</p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.recent-records-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  pointer-events: none;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(15, 5, 8, 0.78);
    backdrop-filter: blur(18px);
    pointer-events: auto;
  }
}

.recent-records-panel {
  position: relative;
  pointer-events: auto;
  width: min(420px, 100%);
  max-height: min(88vh, 92dvh);
  display: flex;
  flex-direction: column;
  background: linear-gradient(
      180deg,
      rgba(26, 9, 17, 0.97),
      rgba(12, 3, 9, 0.96)
    )
    #0a0308;
  box-shadow: 0 32px 72px rgba(8, 2, 6, 0.75);
  overflow: hidden;
}

.recent-records-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(1.1rem, 4vw, 1.6rem);
  padding: clamp(1.9rem, 5vw, 2.4rem) clamp(1.8rem, 5vw, 2.4rem);
  color: #f8fafc;
  background: #0f0a11;
  overflow: hidden;
  border-bottom: 1px solid rgba(244, 114, 182, 0.18);
  isolation: isolate;
  height: 18rem;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(
        circle at 0% -10%,
        rgba(244, 114, 182, 0.35),
        transparent 55%
      ),
      radial-gradient(
        circle at 80% 10%,
        rgba(14, 165, 233, 0.28),
        transparent 58%
      ),
      linear-gradient(200deg, rgba(39, 18, 32, 0.1), rgba(13, 4, 10, 0.1));
    z-index: 1;
    pointer-events: none;
    height: 120px;
    top: 200px;
  }
}

.recent-records-close {
  position: absolute;
  top: 1.1rem;
  left: 1.1rem;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(15, 11, 14, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: rgba(248, 250, 252, 0.92);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: transform 160ms ease, background 160ms ease;
  box-shadow: 0 10px 24px rgba(5, 2, 3, 0.45);

  &:hover {
    transform: translateY(-1px);
    background: rgba(35, 25, 31, 0.86);
  }

  svg {
    width: 22px;
    height: 22px;
  }
}

.recent-records-list {
  padding: 1rem;
  overflow-y: auto;
  scrollbar-width: thin;
  height: 38rem;

  &::-webkit-scrollbar {
    width: 1px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.35);
    border-radius: 999px;
  }
}

.records-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  gap: 1rem;

  p {
    margin: 0;
    color: rgba(226, 232, 240, 0.7);
    font-size: 0.9rem;
  }
}

.records-loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(148, 163, 184, 0.2);
  border-top-color: rgba(236, 72, 153, 0.8);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.records-end {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;

  p {
    margin: 0;
    color: rgba(148, 163, 184, 0.6);
    font-size: 0.85rem;
    text-align: center;
  }
}

.recent-records-hero__media {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transform: scale(1.05);
    filter: brightness(0.82) saturate(1.05);
  }
}

.recent-records-hero__content {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  position: relative;
  z-index: 2;
  margin-top: 32vw;
}

.recent-records-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
  z-index: 2;
}

.recent-records-hero__badge-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 16px;
  background: linear-gradient(
    135deg,
    rgba(236, 72, 153, 0.78),
    rgba(244, 63, 94, 0.65)
  );
  border: 1px solid rgba(254, 205, 211, 0.7);
  box-shadow: 0 16px 32px rgba(236, 72, 153, 0.45);
  font-size: 1.6rem;
  line-height: 1;
  color: rgba(255, 241, 242, 0.95);

  svg {
    width: 26px;
    height: 26px;
  }
}

.recent-records-hero__badge-label {
  margin: 0;
  font-size: 1.05rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 241, 242, 0.9);
  position: relative;
  z-index: 2;
}

.recent-records-hero__text {
  position: relative;
  z-index: 2;
}

.recent-records-hero__text p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
  color: rgba(248, 250, 252, 0.78);
}

.recent-record-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 30px;
  border: 1px solid rgba(96, 42, 72, 0.55);
  background: linear-gradient(150deg, #2a1224 0%, #11060f 100%);
  box-shadow: 0 26px 58px rgba(8, 0, 18, 0.58),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;
  margin-bottom: 1rem;
}

.recent-record-card__media {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 7.5rem;
}

.recent-record-card__media-frame {
  position: relative;
  display: grid;
  place-items: center;
  border-radius: 26px;
  box-shadow: 0 20px 44px rgba(220, 172, 46, 0.38);
}

.recent-record-card__media img {
  position: relative;
  z-index: 1;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 20px;
  object-fit: cover;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.recent-record-card__body {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  color: rgba(248, 246, 255, 0.94);
}

.recent-record-card__header {
  display: flex;
  flex-direction: column;
}

.recent-record-card__heading {
  display: flex;
  flex-direction: column;
}

.recent-record-card__name {
  margin: 0;
  font-size: 1.14rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(255, 243, 248, 0.96);
}

.recent-record-card__tagline {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 236, 213, 0.62);
}

.recent-record-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.3rem;
}

.recent-record-card__metrics {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  color: rgba(255, 241, 242, 0.9);
}

.recent-record-card__metric {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.86rem;
  font-variant-numeric: tabular-nums;
}

.recent-record-card__metric-icon {
  width: 16px;
  height: 16px;
  color: rgba(253, 224, 71, 0.96);
  filter: drop-shadow(0 3px 8px rgba(250, 204, 21, 0.26));
}

.recent-record-card__metric-value {
  letter-spacing: 0.02em;
}

.recent-record-card__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: linear-gradient(
    145deg,
    rgba(255, 237, 213, 0.2),
    rgba(255, 208, 120, 0.16)
  );
  border: 1px solid rgba(255, 210, 130, 0.3);
  color: rgba(255, 249, 196, 0.9);
  box-shadow: 0 12px 22px rgba(250, 204, 21, 0.18);
  padding: 0;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease,
    color 0.18s ease;
  appearance: none;

  svg {
    width: 15px;
    height: 15px;
  }

  &:hover,
  &:focus-visible {
    transform: translateY(-1px);
    box-shadow: 0 16px 28px rgba(250, 204, 21, 0.28);
    color: rgba(255, 255, 255, 0.95);
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.35),
      0 16px 28px rgba(250, 204, 21, 0.28);
  }
}

.recent-record-card__description {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.62;
  color: rgba(233, 230, 240, 0.82);
  text-shadow: 0 10px 22px rgba(0, 0, 0, 0.32);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 640px) {
  .recent-records-panel {
    width: 100%;
    max-height: calc(100vh - 0.5rem);
    max-height: calc(100dvh - 0.5rem);
  }

  .recent-records-hero {
    padding: clamp(1.3rem, 6vw, 1.8rem);
  }

  .recent-records-close {
    top: 0.9rem;
    left: 0.9rem;
  }
}
</style>
