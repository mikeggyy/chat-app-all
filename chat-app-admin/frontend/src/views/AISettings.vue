<template>
  <div class="ai-settings-page">
    <h2>AI 參數設定</h2>
    <p class="page-description">
      控制主應用中使用的 AI 服務參數。修改這些參數會影響所有用戶的 AI 體驗。
    </p>

    <el-alert
      v-if="saved"
      title="設定已保存"
      type="success"
      :closable="false"
      style="margin-bottom: 20px"
      show-icon
    />

    <el-tabs v-model="activeTab" v-loading="loading">
      <!-- 聊天 AI -->
      <el-tab-pane label="聊天 AI" name="chat">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>對話生成 AI (OpenAI GPT)</span>
              <el-tag size="small">核心功能</el-tag>
            </div>
          </template>

          <el-form :model="settings.chat" label-width="150px">
            <el-form-item label="模型">
              <div>
                <el-select v-model="settings.chat.model" placeholder="選擇模型">
                  <el-option label="gpt-4o-mini" value="gpt-4o-mini" />
                  <el-option label="gpt-4o" value="gpt-4o" />
                  <el-option label="gpt-4-turbo" value="gpt-4-turbo" />
                  <el-option label="gpt-3.5-turbo" value="gpt-3.5-turbo" />
                </el-select>
                <div class="help-text">用於生成 AI 角色回覆的模型</div>
              </div>
            </el-form-item>

            <el-form-item label="Temperature">
              <div>
                <el-slider
                  v-model="settings.chat.temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  show-input
                  :input-size="'small'"
                />
                <div class="help-text">
                  控制回覆的隨機性（0 = 確定性，2 = 非常隨機）。推薦值：0.7
                </div>
              </div>
            </el-form-item>

            <el-form-item label="Top P">
              <div>
                <el-slider
                  v-model="settings.chat.topP"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  show-input
                  :input-size="'small'"
                />
                <div class="help-text">
                  核採樣參數，控制回覆的多樣性。推薦值：0.9
                </div>
              </div>
            </el-form-item>

            <el-form-item label="最大 Tokens">
              <div>
                <el-input-number
                  v-model="settings.chat.maxTokens"
                  :min="50"
                  :max="1000"
                  :step="10"
                />
                <div class="help-text">
                  每次回覆的最大長度（免費會員預設值）。約 1 token = 0.75
                  個中文字
                </div>
              </div>
            </el-form-item>

            <el-form-item label="System Prompt 模板">
              <div>
                <div class="editor-wrapper">
                  <editor-content :editor="chatEditor" />
                </div>
                <div class="help-text">
                  點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）
                </div>
                <div class="variables-container">
                  <el-tag
                    v-for="variable in chatVariables"
                    :key="variable.name"
                    size="small"
                    type="info"
                    effect="plain"
                    class="variable-tag clickable"
                    @click="insertVariable('chat', variable.name)"
                  >
                    {{ variable.name }}
                  </el-tag>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 語音生成 -->
      <el-tab-pane label="語音生成" name="tts">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>文字轉語音 AI (OpenAI TTS)</span>
              <el-tag size="small" type="success">語音</el-tag>
            </div>
          </template>

          <el-form :model="settings.tts" label-width="150px">
            <el-form-item label="模型">
              <div>
                <el-select v-model="settings.tts.model" placeholder="選擇模型">
                  <el-option label="tts-1 (標準)" value="tts-1" />
                  <el-option label="tts-1-hd (高清)" value="tts-1-hd" />
                </el-select>
                <div class="help-text">TTS 模型版本</div>
              </div>
            </el-form-item>

            <el-form-item label="預設語音">
              <div>
                <el-select
                  v-model="settings.tts.defaultVoice"
                  placeholder="選擇預設語音"
                >
                  <el-option
                    v-for="voice in settings.tts.availableVoices"
                    :key="voice"
                    :label="voice"
                    :value="voice"
                  />
                </el-select>
                <div class="help-text">角色未指定語音時使用的預設語音</div>
              </div>
            </el-form-item>

            <el-form-item label="可用語音">
              <div>
                <el-select
                  v-model="settings.tts.availableVoices"
                  multiple
                  placeholder="選擇可用語音"
                >
                  <el-option label="nova (女性)" value="nova" />
                  <el-option label="alloy (中性)" value="alloy" />
                  <el-option label="echo (男性)" value="echo" />
                  <el-option label="fable (英式男性)" value="fable" />
                  <el-option label="onyx (男性)" value="onyx" />
                  <el-option label="shimmer (女性)" value="shimmer" />
                </el-select>
                <div class="help-text">用戶可選擇的語音列表</div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 圖片生成 -->
      <el-tab-pane label="圖片生成" name="imageGeneration">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>角色自拍生成 AI (Gemini 2.5 Flash Image)</span>
              <el-tag size="small" type="warning">圖片</el-tag>
            </div>
          </template>

          <el-form :model="settings.imageGeneration" label-width="150px">
            <el-form-item label="模型">
              <div>
                <el-input v-model="settings.imageGeneration.model" disabled />
                <div class="help-text">
                  使用 Google Gemini 2.5 Flash Image 模型
                </div>
              </div>
            </el-form-item>

            <el-form-item label="圖片比例">
              <div>
                <el-select
                  v-model="settings.imageGeneration.aspectRatio"
                  placeholder="選擇比例"
                >
                  <el-option label="1:1 (正方形)" value="1:1" />
                  <el-option label="2:3 (直向)" value="2:3" />
                  <el-option label="3:2 (橫向)" value="3:2" />
                  <el-option label="9:16 (手機直向)" value="9:16" />
                  <el-option label="16:9 (手機橫向)" value="16:9" />
                </el-select>
                <div class="help-text">生成圖片的寬高比</div>
              </div>
            </el-form-item>

            <el-form-item label="壓縮質量">
              <div>
                <el-slider
                  v-model="settings.imageGeneration.compressionQuality"
                  :min="10"
                  :max="100"
                  :step="5"
                  show-input
                  :input-size="'small'"
                />
                <div class="help-text">
                  WebP 壓縮質量（10-100），較低值可節省儲存空間。推薦值：40
                </div>
              </div>
            </el-form-item>

            <el-divider />

            <el-form-item label="圖片生成提示詞模板">
              <div>
                <div class="editor-wrapper">
                  <editor-content :editor="selfieEditor" />
                </div>
                <div class="help-text">
                  點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）（注意：此模板使用英文撰寫）
                </div>
                <div class="variables-container">
                  <el-tag
                    v-for="variable in videoVariables"
                    :key="variable.name"
                    size="small"
                    type="success"
                    effect="plain"
                    class="variable-tag clickable"
                    @click="insertSelfieVariable(variable.name)"
                  >
                    {{ variable.name }}
                  </el-tag>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 影片生成 -->
      <el-tab-pane label="影片生成" name="videoGeneration">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>角色影片生成 AI (Veo 3.0 Fast)</span>
              <el-tag size="small" type="danger">影片</el-tag>
            </div>
          </template>

          <el-form :model="settings.videoGeneration" label-width="150px">
            <el-form-item label="模型">
              <div>
                <el-input v-model="settings.videoGeneration.model" disabled />
                <div class="help-text">使用 Google Veo 3.0 Fast 模型</div>
              </div>
            </el-form-item>

            <el-form-item label="影片長度">
              <div>
                <div>
                  <el-input-number
                    v-model="settings.videoGeneration.durationSeconds"
                    :min="2"
                    :max="8"
                    :step="1"
                  />
                  <span style="margin-left: 10px">秒</span>
                </div>
                <div class="help-text">
                  影片時長（使用參考圖片時必須為 8 秒）
                </div>
              </div>
            </el-form-item>

            <el-form-item label="解析度">
              <div>
                <el-select
                  v-model="settings.videoGeneration.resolution"
                  placeholder="選擇解析度"
                >
                  <el-option label="720p" value="720p" />
                  <el-option label="1080p" value="1080p" />
                </el-select>
                <div class="help-text">影片解析度</div>
              </div>
            </el-form-item>

            <el-form-item label="影片比例">
              <div>
                <el-select
                  v-model="settings.videoGeneration.aspectRatio"
                  placeholder="選擇比例"
                >
                  <el-option label="9:16 (垂直)" value="9:16" />
                  <el-option label="16:9 (水平)" value="16:9" />
                  <el-option label="1:1 (正方形)" value="1:1" />
                </el-select>
                <div class="help-text">影片寬高比（推薦 9:16 適合手機）</div>
              </div>
            </el-form-item>

            <el-form-item label="生成數量">
              <div>
                <el-input-number
                  v-model="settings.videoGeneration.sampleCount"
                  :min="1"
                  :max="4"
                  :step="1"
                />
                <div class="help-text">每次生成的影片數量（1-4）</div>
              </div>
            </el-form-item>

            <el-form-item label="壓縮質量">
              <div>
                <el-select
                  v-model="settings.videoGeneration.compressionQuality"
                >
                  <el-option label="優化 (推薦)" value="optimized" />
                  <el-option label="無損" value="lossless" />
                </el-select>
                <div class="help-text">影片壓縮質量</div>
              </div>
            </el-form-item>

            <el-form-item label="強化提示詞">
              <div>
                <el-switch v-model="settings.videoGeneration.enhancePrompt" />
                <div class="help-text">使用 Gemini 自動優化提示詞</div>
              </div>
            </el-form-item>

            <el-form-item label="人物生成">
              <div>
                <el-select v-model="settings.videoGeneration.personGeneration">
                  <el-option label="允許成人人物" value="allow_adult" />
                  <el-option label="不生成人物" value="dont_allow" />
                </el-select>
                <div class="help-text">人物生成策略</div>
              </div>
            </el-form-item>

            <el-form-item label="啟用重試">
              <div>
                <el-switch v-model="settings.videoGeneration.enableRetry" />
                <div class="help-text">API 失敗時自動重試</div>
              </div>
            </el-form-item>

            <el-form-item
              label="最大重試次數"
              v-if="settings.videoGeneration.enableRetry"
            >
              <div>
                <el-input-number
                  v-model="settings.videoGeneration.maxRetries"
                  :min="1"
                  :max="5"
                  :step="1"
                />
                <div class="help-text">API 失敗時的最大重試次數</div>
              </div>
            </el-form-item>

            <el-form-item label="使用測試影片">
              <div>
                <el-switch v-model="settings.videoGeneration.useMockVideo" />
                <div class="help-text">
                  啟用後不調用 API，返回模擬影片（節省配額）
                </div>
              </div>
            </el-form-item>

            <el-form-item label="Video Prompt 模板">
              <div>
                <div class="editor-wrapper">
                  <editor-content :editor="videoEditor" />
                </div>
                <div class="help-text">
                  點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）（注意：此模板使用英文撰寫）
                </div>
                <div class="variables-container">
                  <el-tag
                    v-for="variable in videoVariables"
                    :key="variable.name"
                    size="small"
                    type="danger"
                    effect="plain"
                    class="variable-tag clickable"
                    @click="insertVariable('video', variable.name)"
                  >
                    {{ variable.name }}
                  </el-tag>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- AI 魔術師 1 -->
      <el-tab-pane label="角色設定生成" name="characterPersona">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>角色設定生成 AI 魔術師</span>
              <el-tag size="small" type="info">角色創建</el-tag>
            </div>
          </template>

          <el-form :model="settings.characterPersona" label-width="180px">
            <el-form-item label="模型">
              <div>
                <el-select
                  v-model="settings.characterPersona.model"
                  placeholder="選擇模型"
                >
                  <el-option label="gpt-4o-mini" value="gpt-4o-mini" />
                  <el-option label="gpt-4o" value="gpt-4o" />
                  <el-option label="gpt-4-turbo" value="gpt-4-turbo" />
                </el-select>
                <div class="help-text">用於生成角色人格設定的模型</div>
              </div>
            </el-form-item>

            <el-form-item label="Temperature">
              <div>
                <el-slider
                  v-model="settings.characterPersona.temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  show-input
                  :input-size="'small'"
                />
                <div class="help-text">控制角色設定的創造性（推薦 0.8）</div>
              </div>
            </el-form-item>

            <el-form-item label="Top P">
              <div>
                <el-slider
                  v-model="settings.characterPersona.topP"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  show-input
                  :input-size="'small'"
                />
                <div class="help-text">核採樣參數（推薦 0.95）</div>
              </div>
            </el-form-item>

            <el-form-item label="名稱長度">
              <div>
                <el-input-number
                  v-model="settings.characterPersona.maxNameLength"
                  :min="4"
                  :max="20"
                  :step="1"
                />
                <div class="help-text">角色名稱的最大字數限制</div>
              </div>
            </el-form-item>

            <el-form-item label="公開背景長度">
              <div>
                <el-input-number
                  v-model="settings.characterPersona.maxTaglineLength"
                  :min="50"
                  :max="500"
                  :step="10"
                />
                <div class="help-text">公開背景（角色設定）的最大字數限制</div>
              </div>
            </el-form-item>

            <el-form-item label="隱藏背景長度">
              <div>
                <el-input-number
                  v-model="settings.characterPersona.maxHiddenProfileLength"
                  :min="50"
                  :max="500"
                  :step="10"
                />
                <div class="help-text">隱藏背景（內心設定）的最大字數限制</div>
              </div>
            </el-form-item>

            <el-form-item label="開場白長度">
              <div>
                <el-input-number
                  v-model="settings.characterPersona.maxPromptLength"
                  :min="20"
                  :max="100"
                  :step="5"
                />
                <div class="help-text">最大字數限制</div>
              </div>
            </el-form-item>

            <el-divider />

            <el-form-item label="角色設定提示詞模板">
              <div>
                <div class="editor-wrapper">
                  <editor-content :editor="personaEditor" />
                </div>
                <div class="help-text">
                  使用 GPT-4o Vision API 分析選定的角色照片並生成角色設定。
                  <br />
                  點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）。
                  <br />
                  <strong>注意：</strong>此模板使用英文撰寫，但會要求 AI 以繁體中文輸出結果
                </div>
                <div class="variables-container">
                  <el-tag
                    v-for="variable in personaVariables"
                    :key="variable.name"
                    size="small"
                    type="success"
                    effect="plain"
                    class="variable-tag clickable"
                    @click="insertPersonaVariable(variable.name)"
                  >
                    {{ variable.name }}
                  </el-tag>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 創建角色照片 -->
      <el-tab-pane label="創建角色照片" name="characterImage">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>創建角色照片</span>
              <el-tag size="small" type="info">角色創建</el-tag>
            </div>
          </template>

          <el-form :model="settings.characterImage" label-width="200px">
            <el-form-item label="模型">
              <div>
                <el-input v-model="settings.characterImage.model" disabled />
                <div class="help-text">使用 OpenAI gpt-image-1-mini 模型</div>
              </div>
            </el-form-item>

            <el-form-item label="圖片尺寸">
              <div>
                <el-select
                  v-model="settings.characterImage.size"
                  placeholder="選擇尺寸"
                  style="width: 240px"
                >
                  <el-option label="1024x1024 (正方形)" value="1024x1024" />
                  <el-option label="1024x1536 (2:3 直向)" value="1024x1536" />
                  <el-option label="1536x1024 (3:2 橫向)" value="1536x1024" />
                </el-select>
                <div class="help-text">生成圖片的尺寸</div>
              </div>
            </el-form-item>

            <el-form-item label="圖片質量">
              <div>
                <el-select
                  v-model="settings.characterImage.quality"
                  placeholder="選擇質量"
                  style="width: 200px"
                >
                  <el-option label="Low (低)" value="low" />
                  <el-option label="Medium (中)" value="medium" />
                  <el-option label="High (高)" value="high" />
                </el-select>
                <div class="help-text">圖片生成質量</div>
              </div>
            </el-form-item>

            <el-form-item label="生成數量">
              <div>
                <el-input-number
                  v-model="settings.characterImage.count"
                  :min="1"
                  :max="10"
                  :step="1"
                />
                <div class="help-text">每次生成的圖片數量</div>
              </div>
            </el-form-item>

            <el-form-item label="外觀描述長度">
              <div>
                <el-input-number
                  v-model="
                    settings.characterImage.maxAppearanceDescriptionLength
                  "
                  :min="30"
                  :max="200"
                  :step="10"
                />
                <div class="help-text">角色外觀描述的最大字數</div>
              </div>
            </el-form-item>

            <el-divider />

            <el-form-item label="圖片生成提示詞模板">
              <div>
                <div class="editor-wrapper">
                  <editor-content :editor="imageEditor" />
                </div>
                <div class="help-text">
                  點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）（注意：此模板使用英文撰寫）
                </div>
                <div class="variables-container">
                  <el-tag
                    v-for="variable in imageVariables"
                    :key="variable.name"
                    size="small"
                    type="warning"
                    effect="plain"
                    class="variable-tag clickable"
                    @click="insertImageVariable(variable.name)"
                  >
                    {{ variable.name }}
                  </el-tag>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- AI 魔術師 3 -->
      <el-tab-pane label="形象描述生成" name="characterAppearance">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>形象描述生成 AI 魔術師</span>
              <el-tag size="small" type="info">角色創建</el-tag>
            </div>
          </template>

          <el-form :model="settings.characterAppearance" label-width="200px">
            <el-form-item label="模型">
              <div>
                <el-select
                  v-model="settings.characterAppearance.model"
                  placeholder="選擇模型"
                >
                  <el-option label="gpt-4o-mini" value="gpt-4o-mini" />
                  <el-option label="gpt-4o" value="gpt-4o" />
                  <el-option label="gpt-4-turbo" value="gpt-4-turbo" />
                </el-select>
                <div class="help-text">
                  生成形象描述的模型。<strong>注意：</strong>當用戶上傳照片時，系統會自動使用
                  gpt-4o（Vision API）分析照片；無照片時使用 gpt-4o-mini
                  純文字生成
                </div>
              </div>
            </el-form-item>

            <el-form-item label="Temperature">
              <div>
                <el-slider
                  v-model="settings.characterAppearance.temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  show-input
                  :input-size="'small'"
                />
                <div class="help-text">控制描述的創造性（推薦 0.7）</div>
              </div>
            </el-form-item>

            <el-form-item label="Top P">
              <div>
                <el-slider
                  v-model="settings.characterAppearance.topP"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  show-input
                  :input-size="'small'"
                />
                <div class="help-text">核採樣參數（推薦 0.9）</div>
              </div>
            </el-form-item>

            <el-form-item label="形象描述長度">
              <div>
                <el-input-number
                  v-model="settings.characterAppearance.maxAppearanceLength"
                  :min="30"
                  :max="200"
                  :step="10"
                />
                <div class="help-text">最大字數限制</div>
              </div>
            </el-form-item>

            <el-divider />

            <el-form-item label="形象描述提示詞模板（有照片）">
              <div>
                <div class="editor-wrapper">
                  <editor-content :editor="appearanceWithImageEditor" />
                </div>
                <div class="help-text">
                  當用戶上傳參考照片時使用此模板（使用 GPT-4o Vision API 分析照片）。
                  <br />
                  點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）。
                  <br />
                  <strong>注意：</strong>此模板使用英文撰寫，但會要求 AI 以繁體中文輸出結果
                </div>
                <div class="variables-container">
                  <el-tag
                    v-for="variable in appearanceVariables"
                    :key="variable.name"
                    size="small"
                    type="success"
                    effect="plain"
                    class="variable-tag clickable"
                    @click="insertAppearanceWithImageVariable(variable.name)"
                  >
                    {{ variable.name }}
                  </el-tag>
                </div>
              </div>
            </el-form-item>

            <el-divider />

            <el-form-item label="形象描述提示詞模板（無照片）">
              <div>
                <div class="editor-wrapper">
                  <editor-content :editor="appearanceWithoutImageEditor" />
                </div>
                <div class="help-text">
                  當用戶未上傳參考照片時使用此模板（純文字模式，使用 GPT-4o-mini）。
                  <br />
                  點擊下方變數標籤可插入到編輯器中（變數無法被編輯，只能整個刪除）。
                  <br />
                  <strong>注意：</strong>此模板使用繁體中文撰寫
                </div>
                <div class="variables-container">
                  <el-tag
                    v-for="variable in appearanceVariables"
                    :key="variable.name"
                    size="small"
                    type="warning"
                    effect="plain"
                    class="variable-tag clickable"
                    @click="insertAppearanceWithoutImageVariable(variable.name)"
                  >
                    {{ variable.name }}
                  </el-tag>
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 操作按鈕 -->
    <div class="action-buttons">
      <el-button
        type="primary"
        size="large"
        :loading="saving"
        @click="saveSettings"
      >
        <el-icon><Check /></el-icon> 保存設定
      </el-button>
      <el-button size="large" @click="resetSettings">
        <el-icon><RefreshLeft /></el-icon> 重置為預設值
      </el-button>
      <el-button size="large" @click="loadSettings">
        <el-icon><Refresh /></el-icon> 重新載入
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, onBeforeUnmount } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Check, RefreshLeft, Refresh } from "@element-plus/icons-vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import VariableNode from "../components/VariableNode.js";
import api from "../utils/api";

const loading = ref(false);
const saving = ref(false);
const saved = ref(false);
const activeTab = ref("chat");

const settings = reactive({
  chat: {
    model: "gpt-4o-mini",
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 150,
    systemPromptTemplate: "",
    description: "對話生成 AI",
  },
  tts: {
    model: "tts-1",
    defaultVoice: "nova",
    availableVoices: ["nova", "alloy", "echo", "fable", "onyx", "shimmer"],
    description: "文字轉語音 AI",
  },
  imageGeneration: {
    model: "gemini-2.5-flash-image",
    aspectRatio: "2:3",
    compressionQuality: 40,
    imagePromptTemplate: "",
    description: "角色自拍照片生成 AI",
  },
  videoGeneration: {
    model: "veo-3.0-fast-generate-001",
    durationSeconds: 8,
    resolution: "720p",
    sampleCount: 1,
    aspectRatio: "9:16",
    compressionQuality: "optimized",
    enhancePrompt: true,
    personGeneration: "allow_adult",
    enableRetry: true,
    maxRetries: 3,
    useMockVideo: false,
    videoPromptTemplate: "",
    description: "角色影片生成 AI",
  },
  characterPersona: {
    model: "gpt-4o",
    temperature: 0.8,
    topP: 0.95,
    maxNameLength: 8,
    maxTaglineLength: 200,
    maxHiddenProfileLength: 200,
    maxPromptLength: 50,
    personaPromptTemplate: "",
    description: "角色設定生成 AI 魔術師",
  },
  characterImage: {
    model: "gpt-image-1-mini",
    size: "1024x1536",
    quality: "high",
    count: 4,
    imagePromptTemplate: "",
    description: "創建角色照片",
  },
  characterAppearance: {
    model: "gpt-4o",
    temperature: 0.7,
    topP: 0.9,
    maxAppearanceLength: 60,
    appearancePromptTemplateWithImage: "",
    appearancePromptTemplateWithoutImage: "",
    description: "形象描述生成 AI 魔術師",
  },
});

// 聊天 AI 可用變數
const chatVariables = [
  { name: "{角色名稱}" },
  { name: "{性別}" },
  { name: "{用戶名稱}" },
  { name: "{用戶性別}" },
  { name: "{用戶年齡}" },
  { name: "{用戶預設提示}" },
  { name: "{角色公開背景}" },
  { name: "{角色隱藏設定}" },
  { name: "{劇情鉤子}" },
];

// 影片生成可用變數
const videoVariables = [{ name: "{角色背景設定}" }, { name: "{最近對話內容}" }];

// 創建角色照片可用變數
const imageVariables = [{ name: "{性別}" }, { name: "{風格}" }];

// 形象描述生成可用變數
const appearanceVariables = [
  { name: "{性別}" },
  { name: "{風格}" },
  { name: "{最大形象描述長度}" },
];

// 角色設定生成可用變數
const personaVariables = [
  { name: "{性別}" },
  { name: "{風格}" },
  { name: "{最大角色名長度}" },
  { name: "{最大角色設定長度}" },
  { name: "{最大隱藏設定長度}" },
  { name: "{最大開場白長度}" },
];

// 將包含變數的文本轉換為編輯器內容
const textToEditorContent = (text, variables) => {
  if (!text) return "";

  // 按段落分割文本
  const paragraphs = text.split("\n\n");
  const docContent = [];

  paragraphs.forEach((paragraph) => {
    const paragraphContent = [];
    let lastIndex = 0;

    // 找出所有變數的位置
    const varPattern = new RegExp(
      variables.map((v) => v.name.replace(/[{}]/g, "\\$&")).join("|"),
      "g"
    );
    let match;

    while ((match = varPattern.exec(paragraph)) !== null) {
      // 添加變數前的文字
      if (match.index > lastIndex) {
        paragraphContent.push({
          type: "text",
          text: paragraph.substring(lastIndex, match.index),
        });
      }

      // 添加變數節點
      let varType = "default";
      if (variables === chatVariables) {
        varType = "info";
      } else if (variables === videoVariables) {
        varType = "danger"; // 用於 videoEditor (但 selfieEditor 使用 success，在 watch 中處理)
      } else if (variables === imageVariables) {
        varType = "warning";
      } else if (variables === appearanceVariables) {
        varType = "default";
      }

      paragraphContent.push({
        type: "variable",
        attrs: {
          name: match[0],
          type: varType,
        },
      });

      lastIndex = match.index + match[0].length;
    }

    // 添加剩餘的文字
    if (lastIndex < paragraph.length) {
      paragraphContent.push({
        type: "text",
        text: paragraph.substring(lastIndex),
      });
    }

    // 如果段落有內容，添加到文檔中
    if (paragraphContent.length > 0) {
      docContent.push({
        type: "paragraph",
        content: paragraphContent,
      });
    } else if (paragraph === "") {
      // 空段落也要保留
      docContent.push({
        type: "paragraph",
      });
    }
  });

  return {
    type: "doc",
    content: docContent.length > 0 ? docContent : [{ type: "paragraph" }],
  };
};

// 將編輯器內容轉換回文本（保留變數）
const editorContentToText = (editor) => {
  if (!editor) return "";

  let text = "";
  const json = editor.getJSON();

  const processNode = (node) => {
    if (node.type === "text") {
      text += node.text;
    } else if (node.type === "variable") {
      text += node.attrs.name;
    } else if (node.content) {
      node.content.forEach(processNode);
    }

    // 段落之間添加換行
    if (
      node.type === "paragraph" &&
      json.content.indexOf(node) < json.content.length - 1
    ) {
      text += "\n\n";
    }
  };

  if (json.content) {
    json.content.forEach(processNode);
  }

  return text;
};

// 創建聊天 Prompt 編輯器
const chatEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    VariableNode,
  ],
  content: "",
  editorProps: {
    attributes: {
      class: "tiptap-editor",
    },
  },
  onUpdate: ({ editor }) => {
    settings.chat.systemPromptTemplate = editorContentToText(editor);
  },
});

// 創建影片 Prompt 編輯器
const videoEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    VariableNode,
  ],
  content: "",
  editorProps: {
    attributes: {
      class: "tiptap-editor",
    },
  },
  onUpdate: ({ editor }) => {
    settings.videoGeneration.videoPromptTemplate = editorContentToText(editor);
  },
});

// 圖片生成提示詞編輯器（角色自拍）
const selfieEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    VariableNode,
  ],
  content: "",
  editorProps: {
    attributes: {
      class: "tiptap-editor",
    },
  },
  onUpdate: ({ editor }) => {
    settings.imageGeneration.imagePromptTemplate = editorContentToText(editor);
  },
});

// 圖片生成提示詞編輯器（角色創建）
const imageEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    VariableNode,
  ],
  content: "",
  editorProps: {
    attributes: {
      class: "tiptap-editor",
    },
  },
  onUpdate: ({ editor }) => {
    settings.characterImage.imagePromptTemplate = editorContentToText(editor);
  },
});

// 形象描述生成提示詞編輯器（有照片）
const appearanceWithImageEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    VariableNode,
  ],
  content: "",
  editorProps: {
    attributes: {
      class: "tiptap-editor",
    },
  },
  onUpdate: ({ editor }) => {
    settings.characterAppearance.appearancePromptTemplateWithImage =
      editorContentToText(editor);
  },
});

// 形象描述生成提示詞編輯器（無照片）
const appearanceWithoutImageEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    VariableNode,
  ],
  content: "",
  editorProps: {
    attributes: {
      class: "tiptap-editor",
    },
  },
  onUpdate: ({ editor }) => {
    settings.characterAppearance.appearancePromptTemplateWithoutImage =
      editorContentToText(editor);
  },
});

// 角色設定生成提示詞編輯器
const personaEditor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
    }),
    VariableNode,
  ],
  content: "",
  editorProps: {
    attributes: {
      class: "tiptap-editor",
    },
  },
  onUpdate: ({ editor }) => {
    settings.characterPersona.personaPromptTemplate =
      editorContentToText(editor);
  },
});

// 插入變數到編輯器
const insertVariable = (editorType, variableName) => {
  const editor = editorType === "chat" ? chatEditor.value : videoEditor.value;
  if (editor) {
    editor
      .chain()
      .focus()
      .insertVariable(variableName, editorType === "chat" ? "info" : "danger")
      .run();
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 插入變數到自拍圖片編輯器
const insertSelfieVariable = (variableName) => {
  if (selfieEditor.value) {
    selfieEditor.value
      .chain()
      .focus()
      .insertVariable(variableName, "success")
      .run();
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 插入變數到角色創建圖片編輯器
const insertImageVariable = (variableName) => {
  if (imageEditor.value) {
    imageEditor.value
      .chain()
      .focus()
      .insertVariable(variableName, "warning")
      .run();
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 插入變數到形象描述編輯器（有照片）
const insertAppearanceWithImageVariable = (variableName) => {
  if (appearanceWithImageEditor.value) {
    appearanceWithImageEditor.value
      .chain()
      .focus()
      .insertVariable(variableName, "success")
      .run();
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 插入變數到形象描述編輯器（無照片）
const insertAppearanceWithoutImageVariable = (variableName) => {
  if (appearanceWithoutImageEditor.value) {
    appearanceWithoutImageEditor.value
      .chain()
      .focus()
      .insertVariable(variableName, "warning")
      .run();
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 插入變數到角色設定編輯器
const insertPersonaVariable = (variableName) => {
  if (personaEditor.value) {
    personaEditor.value
      .chain()
      .focus()
      .insertVariable(variableName, "success")
      .run();
    ElMessage.success(`已插入變數：${variableName}`);
  }
};

// 監聽設定載入，更新編輯器內容
watch(
  () => settings.chat.systemPromptTemplate,
  (newValue) => {
    if (
      chatEditor.value &&
      editorContentToText(chatEditor.value) !== newValue
    ) {
      const content = textToEditorContent(newValue, chatVariables);
      chatEditor.value.commands.setContent(content);
    }
  }
);

watch(
  () => settings.videoGeneration.videoPromptTemplate,
  (newValue) => {
    if (
      videoEditor.value &&
      editorContentToText(videoEditor.value) !== newValue
    ) {
      const content = textToEditorContent(newValue, videoVariables);
      videoEditor.value.commands.setContent(content);
    }
  }
);

watch(
  () => settings.imageGeneration.imagePromptTemplate,
  (newValue) => {
    if (
      selfieEditor.value &&
      editorContentToText(selfieEditor.value) !== newValue
    ) {
      const content = textToEditorContent(newValue, videoVariables);
      selfieEditor.value.commands.setContent(content);
    }
  }
);

watch(
  () => settings.characterImage.imagePromptTemplate,
  (newValue) => {
    if (
      imageEditor.value &&
      editorContentToText(imageEditor.value) !== newValue
    ) {
      const content = textToEditorContent(newValue, imageVariables);
      imageEditor.value.commands.setContent(content);
    }
  }
);

watch(
  () => settings.characterAppearance.appearancePromptTemplateWithImage,
  (newValue) => {
    if (
      appearanceWithImageEditor.value &&
      editorContentToText(appearanceWithImageEditor.value) !== newValue
    ) {
      const content = textToEditorContent(newValue, appearanceVariables);
      appearanceWithImageEditor.value.commands.setContent(content);
    }
  }
);

watch(
  () => settings.characterAppearance.appearancePromptTemplateWithoutImage,
  (newValue) => {
    if (
      appearanceWithoutImageEditor.value &&
      editorContentToText(appearanceWithoutImageEditor.value) !== newValue
    ) {
      const content = textToEditorContent(newValue, appearanceVariables);
      appearanceWithoutImageEditor.value.commands.setContent(content);
    }
  }
);

watch(
  () => settings.characterPersona.personaPromptTemplate,
  (newValue) => {
    if (
      personaEditor.value &&
      editorContentToText(personaEditor.value) !== newValue
    ) {
      const content = textToEditorContent(newValue, personaVariables);
      personaEditor.value.commands.setContent(content);
    }
  }
);

// 清理編輯器
onBeforeUnmount(() => {
  chatEditor.value?.destroy();
  videoEditor.value?.destroy();
  selfieEditor.value?.destroy();
  imageEditor.value?.destroy();
  appearanceWithImageEditor.value?.destroy();
  appearanceWithoutImageEditor.value?.destroy();
  personaEditor.value?.destroy();
});

// 載入設定
const loadSettings = async () => {
  loading.value = true;
  try {
    const response = await api.get("/api/ai-settings");
    if (response.success) {
      Object.assign(settings, response.settings);
      ElMessage.success("設定載入成功");
    }
  } catch (error) {
    ElMessage.error("載入設定失敗：" + (error.message || "未知錯誤"));
  } finally {
    loading.value = false;
  }
};

// 保存設定
const saveSettings = async () => {
  saving.value = true;
  saved.value = false;
  try {
    const response = await api.put("/api/ai-settings", settings);
    if (response.success) {
      ElMessage.success("設定保存成功");
      saved.value = true;
      setTimeout(() => {
        saved.value = false;
      }, 3000);
    }
  } catch (error) {
    ElMessage.error("保存設定失敗：" + (error.message || "未知錯誤"));
  } finally {
    saving.value = false;
  }
};

// 重置設定
const resetSettings = async () => {
  try {
    await ElMessageBox.confirm(
      "確定要重置所有 AI 設定為預設值嗎？此操作不可恢復。",
      "重置設定",
      {
        confirmButtonText: "確定重置",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    loading.value = true;
    const response = await api.post("/api/ai-settings/reset");
    if (response.success) {
      Object.assign(settings, response.settings);
      ElMessage.success("設定已重置為預設值");
    }
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("重置設定失敗：" + (error.message || "未知錯誤"));
    }
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.ai-settings-page {
  padding: 20px;
}

h2 {
  margin: 0 0 10px 0;
  font-size: 24px;
  font-weight: 600;
}

.page-description {
  margin-bottom: 20px;
  color: #606266;
  font-size: 14px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.help-text {
  margin-top: 5px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}

.el-card {
  border-radius: 8px;
}

:deep(.el-card__header) {
  padding: 15px 20px;
  border-bottom: 1px solid #ebeef5;
  font-weight: 600;
}

:deep(.el-card__body) {
  padding: 20px;
}

:deep(.el-tabs__item) {
  font-size: 15px;
  padding: 0 25px;
}

.action-buttons {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
  display: flex;
  gap: 15px;
}

:deep(.el-form-item) {
  margin-bottom: 25px;
}

:deep(.el-slider) {
  padding-right: 15px;
}

/* 變數容器樣式 */
.variables-container {
  margin-top: 8px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.variable-tag {
  font-family: "Courier New", monospace;
  font-weight: 500;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.variable-tag.clickable {
  cursor: pointer;
  transition: all 0.2s;
}

.variable-tag.clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* TipTap 編輯器樣式 */
.editor-wrapper {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #fff;
  transition: border-color 0.2s;
}

.editor-wrapper:focus-within {
  border-color: #409eff;
}

:deep(.tiptap-editor) {
  min-height: 200px;
  padding: 12px 15px;
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  outline: none;
}

:deep(.tiptap-editor p) {
  margin: 0.5em 0;
}

:deep(.tiptap-editor p:first-child) {
  margin-top: 0;
}

:deep(.tiptap-editor p:last-child) {
  margin-bottom: 0;
}

/* 變數芯片樣式（在編輯器內） */
:deep(.variable-chip) {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  margin: 0 2px;
  border-radius: 3px;
  font-family: "Courier New", monospace;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
  cursor: default;
  transition: all 0.2s;
}

/* 變數芯片 - info 類型（聊天 AI） */
:deep(.variable-chip--info) {
  background-color: #ecf5ff;
  color: #409eff;
  border: 1px solid #b3d8ff;
}

/* 變數芯片 - danger 類型（影片生成） */
:deep(.variable-chip--danger) {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fbc4c4;
}

/* 變數芯片 - warning 類型（角色創建圖片生成） */
:deep(.variable-chip--warning) {
  background-color: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #f5dab1;
}

/* 變數芯片 - success 類型（角色自拍圖片生成） */
:deep(.variable-chip--success) {
  background-color: #f0f9ff;
  color: #67c23a;
  border: 1px solid #c2e7b0;
}

/* 變數芯片 - default 類型 */
:deep(.variable-chip--default) {
  background-color: #f4f4f5;
  color: #909399;
  border: 1px solid #d3d4d6;
}

/* 選中變數芯片時的樣式 */
:deep(.variable-chip.ProseMirror-selectednode) {
  box-shadow: 0 0 0 2px #409eff;
  outline: none;
}

/* 編輯器聚焦時的佔位符 */
:deep(.tiptap-editor.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: #c0c4cc;
  pointer-events: none;
  height: 0;
}
</style>
