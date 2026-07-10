# 支付宝碰一碰生成探店笔记项目

这个项目可以用来回答“LLM API 基本调用链路是什么”“前端如何接入 AI 生成能力”“AI 应用如何落到业务场景”。

## 业务背景

用户通过支付宝碰一碰打开小程序，进入探店笔记生成页面。用户可以选择系统给出的关键词，也可以上传图片/视频或使用随机素材。前端把用户输入的关键词、活动信息、用户昵称、场景参数等提交给业务后端，由后端触发 AI 生成小红书探店文案、标题和话题标签。生成完成后，前端展示可编辑内容，并支持发布到小红书。

## 代码位置

- 页面入口和新页面 UI：[NewCreatePage.vue](/Users/baihan/all/code/wsc-tee-base/src/pages/note/NewCreatePage.vue:58)
- 生成任务发起和结果轮询：[App.vue](/Users/baihan/all/code/wsc-tee-base/src/pages/note/App.vue:765)
- AI 生成相关接口：[api.js](/Users/baihan/all/code/wsc-tee-base/src/pages/note/api.js:16)
- 轮询工具：[api.js](/Users/baihan/all/code/wsc-tee-base/src/pages/note/api.js:165)

## 真实调用链路

1. 页面根据活动配置判断生成方式。
   - `getActConfigById` 拉活动配置，读取 `keywords`、`contentGenerateTiming`、`poiId`、`useImage`。
   - 如果配置为关键词触发，就先展示关键词选择。

2. 用户选择关键词后触发生成。
   - `handleKeywordsSubmit` 把关键词序列化后传给 `handleChange`。
   - `handleChange` 先做前置校验，避免重复生成和配额不足。

3. 前端请求业务后端创建 AI 生成任务。
   - `createNote` 组装 `again`、`nickName`、页面 query、`kw`、`manualKeyword`。
   - 普通场景走 `/createNote.json`。
   - AI 生成场景走 `/generateContentForC.json`。

4. 后端返回 `requestId`。
   - 前端不直接调用大模型，也不暴露模型 key。
   - `requestId` 代表一次生成任务。
   - 导购场景下还会把 `requestId` 写入 `sessionInfo.guideTaskNo`，用于后续发布回调匹配。

5. 前端轮询生成结果。
   - 通过 `/getAiGenerateResult.json` 查询任务状态。
   - `load` 方法每 1.5 秒轮询一次，直到状态为 `finished`，或超时/失败。

6. 前端转换并展示结果。
   - 成功后通过 `translateNote` 转成页面结构。
   - 页面展示标题、正文、标签。
   - `typing` / `typingList` 做打字机式展示。
   - `agentStatus` 展示“正在思考”“正在参考爆款笔记”“生成完成”等状态。

7. 生成后的编辑和发布。
   - 用户可以编辑标题和正文。
   - 选择图片/视频素材后，通过 `post-note-button` 发布。
   - 发布前会对素材打标，发布后轮询发布状态。

## 这不是 SSE 真流式

这个项目不是模型 token 级 SSE 流式输出，而是：

- 后端异步生成。
- 前端通过 `requestId` 轮询任务结果。
- 拿到完整结果后，前端用打字机效果模拟生成过程。

选择轮询不是因为不了解 SSE，而是出于多端稳定性的工程取舍。这个项目需要覆盖支付宝小程序、微信小程序、小红书小程序和 H5。H5 可以直接使用浏览器 `EventSource` 或 `fetch` stream；微信小程序可以尝试通过 `wx.request + enableChunked + onChunkReceived` 模拟 SSE；但支付宝小程序和小红书小程序不能默认具备同等稳定的 SSE / chunk stream 能力，需要依赖容器 API 和真机验证。多端能力不一致时，`requestId + 轮询` 是更稳定、可控、易降级的基线方案。

面试时要讲清这个边界，反而显得真实：

> 这个项目不是直接接模型的 SSE token 流，而是更适合多端业务系统的异步任务模式。因为项目要跑在支付宝小程序、微信小程序、小红书小程序和 H5，多端对 SSE / chunk stream 的支持不一致，所以我们选择 requestId 轮询作为稳定基线。前端发起生成任务后拿 requestId 轮询结果，后端负责真实 AI 编排和内容生成。前端负责状态机、等待体验、失败兜底、结果编辑和发布链路。

## 如果后期优化成 SSE 流式输出

当前模式是“创建任务 → 返回 `requestId` → 轮询完整结果 → 前端打字机展示”。如果要升级成 SSE，可以改成“创建生成请求 → 服务端持续推送事件 → 前端按事件增量更新 UI”。

## 当前打字机效果和增量渲染怎么实现

当前项目里的“流式感”不是后端 token 流，而是前端在拿到完整笔记后做的打字机动画。

**真实实现位置**

- `note` watcher：[App.vue](/Users/baihan/all/code/wsc-tee-base/src/pages/note/App.vue:461)
- `typing` / `typingList`：[App.vue](/Users/baihan/all/code/wsc-tee-base/src/pages/note/App.vue:680)
- 展示标题和正文：[NewCreatePage.vue](/Users/baihan/all/code/wsc-tee-base/src/pages/note/NewCreatePage.vue:71)

**实现流程**

1. AI 生成任务完成后，`createNote` 返回结构化的 `note`。
2. `handleChange` 把 `note` 赋值到页面状态。
3. `watch.note` 监听到新笔记。
4. 根据 `noteId` 判断这篇笔记是否已经打过字。
5. 如果没打过字：
   - 先清空 `renderTitle`、`renderContent`、`renderContents`。
   - 调用 `typing('renderTitle', title)` 逐字符渲染标题。
   - 再调用 `typingList('renderContents', contents)` 按段落逐字符渲染正文。
   - 正文渲染完成后再展示 tags。
   - 用 `this[cacheKey] = true` 标记这篇笔记已完成动画。
6. 如果已经打过字：
   - 直接展示完整标题、正文和标签，避免历史笔记来回切换时重复动画。

核心代码逻辑：

```js
async note(v) {
  const { title, content, contents, noteId } = v;
  const cacheKey = `${noteId}`;
  const isTyped = this[cacheKey];

  this.renderTitle = isTyped ? title : '';
  this.renderContent = isTyped ? content : '';
  this.renderContents = isTyped ? contents : [];
  this.isRenderTags = !!isTyped;

  if (!isTyped) {
    await this.typing('renderTitle', title);
    await this.typingList('renderContents', contents);
    this.isRenderTags = true;
    this[cacheKey] = true;
  }
}
```

```js
typing(key, text, callback) {
  return new Promise((resolve) => {
    const loop = (s) => {
      callback ? callback(text[s]) : (this[key] += text[s]);
      s >= text.length - 1 ? resolve() : setTimeout(() => loop(s + 1), 10);
    };

    loop(0);
  });
}
```

```js
async typingList(key, contents) {
  let index = 0;
  for (const content of contents) {
    const currentKey = `${key}[${index}]`;
    await this.typing(currentKey, content, (text) => {
      const currentText = get(this, currentKey, '');
      this.$set(this[key], index, currentText + text);
    });
    index++;
  }
}
```

**这个实现的优点**

- 简单，和轮询完整结果模式匹配。
- 用户能感知“AI 正在生成”的过程，不是突然出现一大段文本。
- 标题和正文分阶段出现，体验更像真实生成。
- 用 `noteId` 做动画缓存，避免历史内容重复播放。

**这个实现的不足**

- 不是真实流式，首字出现时间仍然要等后端整篇生成完成。
- 每 10ms 更新一个字符，长文案会触发很多次响应式更新。
- `setTimeout` 无法和浏览器/小程序渲染帧精确对齐。
- 没有统一取消机制，切换笔记或离开页面时可能还在继续跑动画。
- `this[cacheKey] = true` 是动态挂载状态，可维护性一般，最好收敛到明确的数据结构。
- 当前是标题完成后才开始正文，不能并行展示不同事件。

## 更好的打字机 / 增量渲染实现

更好的方案要按“是否有真实流式数据”分两层。

### 方案 1：仍然是轮询完整结果，但优化前端打字机

如果后端仍然返回完整笔记，前端可以把打字机抽成一个可取消、可节流、可复用的渲染器。

核心思路：

- 用队列保存待渲染字符。
- 用 `requestAnimationFrame` 或固定批量更新，而不是每个字符一次 setState。
- 每帧渲染 N 个字符，减少响应式更新次数。
- 支持 `cancel`，页面离开、换一篇、用户编辑时停止动画。
- 用 `typedNoteIds: Set` 管理已播放动画，而不是动态挂在 `this` 上。

示例：

```js
function createTypewriter({ onUpdate, onDone, charsPerFrame = 2 }) {
  let queue = [];
  let frameId = null;
  let stopped = false;

  function tick() {
    if (stopped) return;

    let chunk = '';
    for (let i = 0; i < charsPerFrame && queue.length; i++) {
      chunk += queue.shift();
    }

    if (chunk) {
      onUpdate(chunk);
    }

    if (queue.length) {
      frameId = requestAnimationFrame(tick);
    } else {
      frameId = null;
      onDone && onDone();
    }
  }

  return {
    start(text) {
      stopped = false;
      queue = Array.from(text || '');
      if (!frameId) frameId = requestAnimationFrame(tick);
    },
    cancel() {
      stopped = true;
      queue = [];
      if (frameId) cancelAnimationFrame(frameId);
      frameId = null;
    },
  };
}
```

如果小程序环境没有标准 `requestAnimationFrame`，可以降级为 `setTimeout`，但仍然建议按 chunk 批量更新，而不是每个字符一次更新。

### 方案 2：升级为 SSE / chunk stream 后，按事件增量渲染

如果后端支持 SSE，就不需要等完整笔记返回。前端消费事件：

- `title_delta`：追加标题。
- `content_delta`：追加正文。
- `tags`：设置标签。
- `material`：更新图片/视频素材。
- `done`：生成完成。
- `error`：生成失败。

前端要做一个增量渲染缓冲层：

```js
data() {
  return {
    titleBuffer: '',
    contentBuffer: '',
    renderTitle: '',
    renderContents: [''],
    flushTimer: null,
  };
}
```

收到 token 时先进入 buffer：

```js
function handleContentDelta(text) {
  this.contentBuffer += text;
  this.scheduleFlush();
}
```

定时批量 flush 到 UI：

```js
function scheduleFlush() {
  if (this.flushTimer) return;

  this.flushTimer = setTimeout(() => {
    if (this.titleBuffer) {
      this.renderTitle += this.titleBuffer;
      this.titleBuffer = '';
    }

    if (this.contentBuffer) {
      const index = this.renderContents.length - 1;
      this.$set(
        this.renderContents,
        index,
        this.renderContents[index] + this.contentBuffer
      );
      this.contentBuffer = '';
    }

    this.flushTimer = null;
  }, 50);
}
```

这样可以避免每个 token 都触发视图更新。

### 面试表达

> 当前项目的打字机效果是在轮询拿到完整 AI 结果后实现的。`note` 更新后，watcher 先清空 `renderTitle` 和 `renderContents`，再通过 `typing` 每 10ms 追加一个字符，标题完成后再按段落渲染正文，最后展示标签。为了避免历史笔记重复动画，用 `noteId` 做了已播放缓存。这个实现简单稳定，适合多端轮询方案，但它不是真实流式，首字要等完整结果返回，而且逐字符响应式更新会有性能开销。更好的方案是抽一个可取消的 typewriter 渲染器，用队列和批量 flush 控制更新频率；如果后端升级 SSE，就按 `title_delta/content_delta/tags/done/error` 事件增量更新 UI，并用 buffer 节流渲染，避免每个 token 都触发重绘。

### 后端需要调整

后端提供 SSE 接口，例如：

```http
GET /wscwxvideo/xhs/generateContentStream.json?aid=xxx&kw=xxx
Accept: text/event-stream
```

响应头需要支持流式：

```http
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

后端把模型输出、工具调用、素材推荐、完成状态、错误状态都包装成事件：

```text
event: message_start
data: {"requestId":"xxx"}

event: status
data: {"status":"thinking","text":"正在思考..."}

event: title_delta
data: {"text":"杭州"}

event: content_delta
data: {"text":"这家店真的很适合周末探店"}

event: tags
data: {"items":["杭州探店","周末去哪儿"]}

event: material
data: {"images":["https://..."]}

event: done
data: {"requestId":"xxx"}
```

如果后端存在 Agent / tool calling，也可以推更细的事件：

- `tool_call_start`：开始查商品、查素材、查活动规则。
- `tool_call_result`：工具调用结果。
- `text_delta`：模型文本增量。
- `structured_data`：商品卡片、图片素材、标签。
- `done`：生成完成。
- `error`：生成失败。

### 前端需要调整

前端从轮询 `load(Fn)` 改成消费 SSE。

核心状态可以设计成：

```js
data() {
  return {
    agentStatus: 'init',
    streamController: null,
    renderTitle: '',
    renderContents: [],
    note: {
      title: '',
      content: '',
      tags: [],
    },
    streamError: null,
  };
}
```

如果运行环境支持 `EventSource`，可以这样接：

```js
function startGenerateStream(query) {
  const params = new URLSearchParams(query).toString();
  const source = new EventSource(
    `/wscwxvideo/xhs/generateContentStream.json?${params}`
  );

  source.addEventListener('status', event => {
    const data = JSON.parse(event.data);
    this.agentStatus = data.status;
  });

  source.addEventListener('title_delta', event => {
    const data = JSON.parse(event.data);
    this.renderTitle += data.text;
    this.note.title = this.renderTitle;
  });

  source.addEventListener('content_delta', event => {
    const data = JSON.parse(event.data);
    const index = this.renderContents.length - 1;

    if (index < 0) {
      this.renderContents.push(data.text);
    } else {
      this.$set(this.renderContents, index, this.renderContents[index] + data.text);
    }

    this.note.content = this.renderContents.join('\n');
  });

  source.addEventListener('tags', event => {
    const data = JSON.parse(event.data);
    this.$set(this.note, 'tags', data.items || []);
  });

  source.addEventListener('done', () => {
    this.agentStatus = 'done';
    source.close();
  });

  source.addEventListener('error', () => {
    this.agentStatus = 'error';
    source.close();
  });

  this.streamController = source;
}
```

如果运行环境不支持 `EventSource`，可以让后端用 `fetch` readable stream，或退回轮询。小程序/WebView 环境要特别确认运行容器对 SSE 的支持情况。

### 停止生成怎么做

SSE 是服务端单向推送，前端可以关闭连接：

```js
function stopGenerate() {
  if (this.streamController) {
    this.streamController.close();
    this.streamController = null;
  }
  this.agentStatus = 'stopped';
}
```

但这只断开了前端连接。生产上最好再通知后端取消任务：

```js
api.post({
  url: '/wscwxvideo/xhs/cancelGenerateContent.json',
  data: {
    requestId: this.requestId,
  },
});
```

否则后端可能还在继续消耗模型 token。

### 前端体验要注意

- 不要每个 token 都做重布局，内容更新和滚动到底部要节流。
- Markdown / 文案可能是半截内容，渲染要能容忍未闭合结构。
- 标题、正文、标签、素材最好分事件返回，避免前端从一段自然语言里硬解析。
- 生成失败要保留已生成内容，并提供重试。
- 页面离开时要关闭 SSE，避免内存泄漏和无效消耗。
- 如果用户编辑了正在生成的内容，要定义清楚是暂停生成、覆盖生成，还是另起草稿。

### 和当前轮询方案的取舍

轮询方案：

- 实现简单，和异步任务系统兼容好。
- 更适合“一次生成完整笔记”的业务。
- 体验上只能展示等待态，或拿到完整结果后模拟打字。
- 对支付宝小程序、微信小程序、小红书小程序、H5 这类多端环境更稳定，容器差异更小。
- 更容易做超时、重试、降级和发布状态衔接。

SSE 方案：

- 首 token 更快，用户感知更好。
- 可以展示真实生成过程、工具调用过程和素材检索过程。
- 对后端网关、运行容器、异常恢复、取消任务要求更高。
- 多端支持不一致，需要按端做能力检测和降级。

面试表达：

> 当前项目选择轮询，是因为要覆盖支付宝小程序、微信小程序、小红书小程序和 H5，多端对 SSE 的支持不一致。轮询虽然实时性弱一些，但稳定、可控、容易降级，也更适合一次生成完整笔记的异步任务模式。如果后续要优化成 SSE，我会做能力检测：H5 走 EventSource 或 fetch stream，微信小程序尝试 request chunk，小红书和支付宝先做真机 POC，不支持就继续降级轮询。后端把状态、标题增量、正文增量、标签、素材、完成和错误包装成事件，前端按事件增量更新 UI，同时处理停止生成、页面离开关闭连接、失败重试和性能节流。

## 可以用来回答 LLM API 基本调用链路

面试表达：

> 我之前做过一个支付宝碰一碰打开小程序后生成探店笔记的项目。用户进入页面后选择关键词，前端把关键词、活动 id、用户昵称、场景参数等传给后端创建 AI 生成任务。前端不直接调模型，而是由后端处理 prompt、AI 生成和业务规则，返回 requestId。前端拿 requestId 轮询生成结果，期间用 agentStatus 展示“正在思考/正在参考爆款笔记”，成功后把标题、正文和标签转换成笔记结构，支持用户编辑、换一篇、选择图片/视频素材并发布到小红书。这个项目让我理解了 AI 能力接入不是简单调接口，而是要处理任务状态、配额、失败兜底、内容编辑、素材链路和发布闭环。

## 面试官可能追问

### 追问 1：为什么不让前端直接调大模型？

因为模型 key、prompt、计费、权限、配额、内容安全都不能暴露在浏览器或小程序端。这个项目里前端只请求业务后端，由后端创建 AI 生成任务并返回 `requestId`。这样可以统一做鉴权、配额控制、模型调用、日志和风控。

### 追问 2：为什么用轮询，而不是 SSE？

这个场景生成的是一篇完整笔记，后端可能是异步任务模式，且要结合活动、素材、关键词、导购任务编号等业务链路。轮询实现简单、稳定，适合生成耗时可接受且结果以完整笔记为单位返回的场景。如果要做 ChatGPT 式 token 实时输出，或者希望展示模型逐步推理和工具调用过程，可以升级成 SSE。

### 追问 3：轮询怎么避免无限等？

`load` 方法设置了最大轮询次数，超过上限返回超时失败。状态上只把 `running` / `1` 视为生成中，把 `finished` / `3` 视为成功，其他状态进入失败分支。面试里可以补充：生产上还可以加取消、页面离开停止轮询、指数退避和错误上报。

### 追问 4：AI 生成失败怎么兜底？

前端会把状态置为 error，并展示失败态或“今日 AI 生成次数已耗尽，还可以手动去写评价”。关键词接口失败时，也会降级到“换一篇”的生成能力。用户仍然可以手动编辑内容或上传素材。

### 追问 5：这个项目和 RAG / Agent 有什么关系？

从前端视角，它没有直接实现 RAG 或 Agent 编排，但业务上已经有 Agent 状态和导购任务概念。可以说：

> 当前前端承接的是 AI 生成任务结果和导购场景状态。如果升级为更完整的导购 Agent，可以把关键词、商家信息、商品/优惠/评价作为 RAG 或 tool calling 输入，让后端返回结构化事件流，前端展示“查询素材/参考爆款笔记/生成文案/推荐图片”的过程。

## 可量化补充点

如果后面要包装到简历或面试，最好补真实数据：

- 生成成功率。
- 平均生成耗时。
- 使用关键词生成的比例。
- 换一篇点击率。
- 发布转化率。
- 用户编辑率。
- 图片/视频素材使用率。
- AI 配额耗尽比例。

没有数据时可以说“当时主要负责链路和体验实现，后续我会用这些指标评估生成质量和转化效果”。
