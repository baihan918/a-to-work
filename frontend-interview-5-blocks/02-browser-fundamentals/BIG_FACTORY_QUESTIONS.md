# 浏览器原理：大厂追问题库

## 字节风格

### 1. 输入 URL 后，哪些环节可能影响首屏？

**题解口径**

DNS、TCP/TLS、TTFB、HTML 下载、CSS 阻塞、JS 阻塞解析、图片字体加载、主线程 JS 执行、Layout/Paint、缓存命中都会影响首屏。要结合 Network 瀑布、Performance 主线程和 Web Vitals 定位。

**继续追问**

**追问 1：DNS 慢怎么办？**

可以用 DNS 预解析、减少跨域域名数量、使用稳定 CDN、合理复用连接。前端能做的是减少关键路径上的域名解析成本，比如对关键第三方域名加 `dns-prefetch` 或 `preconnect`，但如果是网络运营商或 CDN 调度问题，需要结合基础设施侧优化。

**追问 2：TTFB 高是前端问题吗？**

不一定。TTFB 反映从发出请求到收到首字节的时间，可能受服务端计算、网关、数据库、CDN 回源、网络链路影响。前端要先用 Network 和 RUM 定位它是否普遍高、某地区高、某接口高，再推动服务端或 CDN 排查。前端可做的主要是缓存、CDN、减少 HTML 动态计算依赖和边缘渲染优化。

**追问 3：CSS 为什么阻塞渲染？**

浏览器需要 DOM 和 CSSOM 合成渲染树后才能正确绘制页面。如果 CSS 没下载或没解析完，浏览器无法确定元素最终样式，贸然绘制会导致闪烁和重复布局，所以关键 CSS 会阻塞首次渲染。

**追问 4：JS 为什么阻塞 DOM 解析？**

同步 JS 可能执行 `document.write`，也可能读取或修改前面已经解析出的 DOM 和样式。为了保证执行语义正确，浏览器遇到普通 script 会暂停 HTML 解析，先下载并执行脚本。可以用 `defer`、`async`、模块拆分和脚本后置降低阻塞。

**追问 5：CSS 会阻塞 DOM 生成吗？如果 CSS 后面跟着同步 JS 呢？**

单独看 CSS，`<link rel="stylesheet">` 不会阻塞 HTML 解析，也不会直接阻塞 DOM 树生成。浏览器解析到 CSS 后会开始下载 CSS，同时继续解析后续 HTML。

但 CSS 会阻塞渲染，也会阻塞其后同步 JS 的执行。原因是同步 JS 可能读取样式，例如 `getComputedStyle`、`offsetWidth`、`getBoundingClientRect`。为了保证 JS 读到的样式是确定的，浏览器在执行同步 JS 前，会等待前面已经发现的 CSS 下载并解析完成。

如果结构是：

```html
<head>
  <link href="theme.css" rel="stylesheet">
</head>
<body>
  <div>geekbang com</div>
  <script src="foo.js"></script>
  <div>geekbang com</div>
</body>
```

阻塞链路是：

1. 解析到 CSS，开始下载 CSS，但 HTML 解析继续。
2. 第一个 `div` 可以生成 DOM。
3. 解析到同步 `script`，HTML 解析暂停。
4. 如果前面的 CSS 还没完成，JS 执行要等 CSSOM 准备好。
5. JS 执行完成后，HTML 解析继续。
6. 第二个 `div` 才继续生成 DOM。

所以准确结论是：

> CSS 不直接阻塞 DOM 构建，但它会阻塞其后同步 JS 的执行；同步 JS 又会阻塞 HTML 解析。因此在 CSS 后面跟同步 JS 的场景里，CSS 会间接阻塞 script 后续 DOM 的生成。阻塞链路是 CSS → JS 执行 → 后续 DOM 解析。

### 2. async 和 defer 区别？

**题解口径**

`async` 下载不阻塞 HTML 解析，下载完成后立即执行，执行会阻塞解析，多个 async 脚本执行顺序不保证。`defer` 下载不阻塞解析，等 HTML 解析完成后按文档顺序执行，通常在 DOMContentLoaded 前。

**面试场景版**

普通 `<script>` 会阻塞 HTML 解析：浏览器遇到脚本后，需要先下载并执行脚本，再继续解析 HTML。因为脚本可能读写 DOM，也可能影响后续解析结果。

`async` 和 `defer` 都能让脚本下载过程不阻塞 HTML 解析，但执行时机不同：

- `async`：脚本下载完成后立刻执行，执行时会暂停 HTML 解析。多个 async 脚本谁先下载完谁先执行，不保证顺序。
- `defer`：脚本下载不阻塞解析，等 HTML 解析完成后再按文档顺序执行，通常在 `DOMContentLoaded` 之前执行完。

**适用场景**

- `async` 适合独立脚本：埋点、广告、统计 SDK、无需依赖 DOM 完整结构、无需依赖其他脚本顺序的第三方脚本。
- `defer` 适合业务主脚本：应用入口、依赖 DOM、多个脚本有执行顺序要求的场景。
- 普通 script 适合极少数必须立刻执行并影响后续解析的脚本，现代前端项目里应尽量少用。

**容易误用**

- 有依赖关系的脚本不要用 `async`，否则执行顺序不稳定。
- 首屏关键业务脚本一般更适合 `defer`，避免阻塞 HTML 解析，同时保证顺序。
- `async` 不是“更快的 defer”，它是“下载完就抢占执行”。

**追问 1：defer 脚本一定在 DOMContentLoaded 前执行吗？**

通常是。浏览器会等带 defer 的脚本下载并按顺序执行完成后，再触发 `DOMContentLoaded`。所以 defer 适合应用初始化脚本。

**追问 2：async 脚本会不会影响 DOMContentLoaded？**

async 脚本不保证在 `DOMContentLoaded` 前或后执行。如果它在 HTML 解析期间下载完成，会立即执行并暂停解析；如果下载较晚，可能在 `DOMContentLoaded` 之后执行。

**追问 3：现代打包应用的入口脚本为什么常用 defer 或 module？**

因为应用入口通常不需要阻塞 HTML 解析，但需要等 DOM 结构基本可用后初始化。`defer` 可以避免阻塞解析并保证执行顺序。`type="module"` 默认具有类似 defer 的行为，并且支持 ESM。

### 3. preload 和 prefetch 区别？

**题解口径**

`preload` 是当前页面即将需要的高优先级资源。`prefetch` 是未来导航可能需要的低优先级资源。误用 preload 会抢占关键资源带宽。

**面试场景版**

`preload` 和 `prefetch` 都是资源提示，但目标不同。

`preload` 用来告诉浏览器：这个资源是当前页面马上要用的关键资源，请提前以较高优先级加载。它常用于首屏关键字体、首屏大图、关键 CSS、关键 JS chunk。

`prefetch` 用来告诉浏览器：这个资源当前页面不急用，但用户之后可能会访问，请在浏览器空闲时低优先级预取。它常用于下一页路由 chunk、鼠标悬停后可能打开的页面资源、登录后大概率进入的页面。

**适用场景**

- `preload`：首屏 LCP 图片、关键字体、关键 CSS、当前路由马上要执行的异步 chunk。
- `prefetch`：下一页 JS、未来路由资源、低优先级图片、用户可能访问但当前不阻塞体验的资源。
- `preconnect`：当前页面马上要请求某个跨域源，提前建立 DNS、TCP、TLS 连接。
- `dns-prefetch`：只提前做 DNS 解析，成本更低，适合不确定但可能访问的域名。

**容易误用**

- 不要把大量资源都 preload。preload 优先级高，会抢占带宽，反而拖慢真正关键资源。
- preload 的资源必须真的被当前页面使用，否则浏览器可能警告资源预加载但未使用。
- 字体 preload 要注意 `as="font"` 和 `crossorigin`，否则可能重复下载。
- prefetch 不适合首屏关键资源，因为它优先级低，浏览器不保证及时加载。

**代码示例**

```html
<!-- 当前页面首屏马上使用的字体 -->
<link
  rel="preload"
  href="/fonts/inter.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>

<!-- 当前页面 LCP 大图 -->
<link rel="preload" href="/hero.webp" as="image" />

<!-- 用户可能进入的下一页路由资源 -->
<link rel="prefetch" href="/assets/settings-page.js" as="script" />

<!-- 提前连接关键 API 域名 -->
<link rel="preconnect" href="https://api.example.com" crossorigin />
```

**追问 1：preload 和浏览器正常发现资源有什么区别？**

浏览器正常发现资源需要先解析到对应标签或 CSS 引用。preload 可以在资源被解析发现前提前加载，缩短关键资源等待时间。例如 CSS 里引用的字体，正常要等 CSS 下载解析后才发现；preload 可以提前请求字体。

**追问 2：为什么 preload 可能导致性能变差？**

因为 preload 会提高资源优先级。如果预加载了非关键资源，它会和 HTML、CSS、关键 JS、首屏图片抢带宽，导致真正关键资源变慢。preload 要少而准。

**追问 3：prefetch 的资源一定会被加载吗？**

不一定。prefetch 是低优先级提示，浏览器会根据网络、设备、电量、缓存策略和空闲情况决定是否加载。不能把关键链路依赖建立在 prefetch 一定成功上。

**追问 4：preload 和 prefetch 如何结合路由懒加载？**

当前路由马上需要的异步 chunk 可以考虑 preload。用户大概率下一步进入的路由，比如 hover 菜单、首屏 CTA 目标页，可以 prefetch。React/Vue 路由懒加载里，通常由框架、构建工具或业务逻辑在合适时机插入资源提示。

### 4. 为什么读取 offsetWidth 后再改样式容易卡？

**题解口径**

如果前面有样式写入还没完成布局，读取 `offsetWidth`、`getBoundingClientRect` 等布局属性会触发强制同步布局。读写交错会造成 layout thrashing。应该批量读、批量写，必要时用 rAF 调度。

### 5. requestAnimationFrame、微任务、setTimeout 谁先执行？

**题解口径**

同步代码先执行。当前宏任务结束后清空微任务。浏览器在合适时机进行渲染，rAF 通常在下一帧绘制前执行。setTimeout 是后续宏任务。具体顺序还要看它们注册的时机和事件循环轮次。

### 6. 微任务过多会怎样？

**题解口径**

微任务队列会在当前宏任务结束后被清空，如果不断塞微任务，会延迟浏览器渲染和后续宏任务，造成页面卡顿。Promise 不是性能隔离手段。

### 7. localStorage 为什么不适合存大量数据？

**题解口径**

localStorage 是同步 API，会阻塞主线程，容量有限，且容易被 XSS 读取。不适合大量结构化数据或敏感 token。大量离线数据更适合 IndexedDB，缓存资源适合 Cache Storage。

### 8. CORS 预检什么时候发生？

**题解口径**

非简单请求会触发预检，例如使用非简单方法、非简单请求头，或某些 Content-Type。浏览器先发 OPTIONS，服务端返回允许的 origin、method、headers 后，浏览器才发真实请求。

### 9. HTTP/2 解决了 HTTP/1.1 队头阻塞，为什么还会受 TCP 队头阻塞影响？

**题解口径**

HTTP/2 解决的是应用层队头阻塞，但没有解决 TCP 传输层队头阻塞。

HTTP/1.1 中，同一个连接上的请求响应基本按顺序处理。前一个响应慢，后面的响应即使已经准备好，也可能被挡住，这是 HTTP 应用层的队头阻塞。

HTTP/2 通过多路复用，把多个请求拆成 frame，在一个 TCP 连接里交错传输。这样应用层不再要求“请求 A 完整返回后才能返回请求 B”，所以它解决了 HTTP 层面的排队问题。

但 HTTP/2 仍然跑在单条 TCP 连接上。TCP 提供可靠、有序的字节流。如果某个 TCP segment 丢失，接收端即使已经收到了后面的 segment，也不能把后面的字节交给上层 HTTP/2 使用，必须等待丢失的包重传。

所以一个 TCP 包丢失，会阻塞这条连接上所有 HTTP/2 stream 的数据交付。HTTP/2 的多个 stream 虽然在应用层独立，但在 TCP 层仍然共享同一个有序字节流。

**面试表达**

> HTTP/2 的多路复用解决了 HTTP 语义上的排队问题，但因为它依赖单个 TCP 连接，而 TCP 必须保证字节流有序，所以一旦某个包丢失，后续已经到达的数据也不能交给上层协议处理。结果就是一个 stream 的丢包会影响同连接里的其他 stream，造成传输层队头阻塞。弱网、移动网络、高丢包场景下，这会明显削弱 HTTP/2 多路复用的收益。

**追问 1：HTTP/3 / QUIC 为什么能缓解这个问题？**

HTTP/3 基于 QUIC，QUIC 基于 UDP，在协议层自己实现可靠传输、拥塞控制和多路复用。QUIC 的 stream 相对独立，某个 stream 丢包主要阻塞这个 stream 自己，不会像 TCP 那样因为单个字节流缺口阻塞整个连接上的所有 stream。

**追问 2：HTTP/2 是不是一定比 HTTP/1.1 快？**

不一定。HTTP/2 在多资源并发、连接复用、头部压缩方面有优势。但在弱网高丢包场景下，单连接 TCP 队头阻塞可能拖累所有 stream。实际性能还受资源数量、资源大小、服务器优先级实现、CDN、TLS、丢包率和浏览器调度影响。

**追问 3：为什么 HTTP/2 仍然通常建议减少域名分片？**

HTTP/1.1 时代常用域名分片绕过浏览器单域名连接数限制。HTTP/2 支持单连接多路复用，过多域名会增加 DNS、TCP、TLS 建连成本，也削弱连接复用收益。但如果单连接在弱网下受 TCP 队头阻塞影响明显，实际系统也可能结合 CDN、资源类型和网络环境做更细的权衡。

### 10. XSS 怎么拿到用户信息？怎么防？

**题解口径**

攻击脚本可以读取页面可访问的 token、localStorage、DOM 信息，并以用户身份发请求。防御包括输出转义、避免危险 HTML、CSP、输入校验、依赖安全、Cookie `HttpOnly`、敏感操作二次确认。

### 11. 怎么判断一个页面是 JS 执行慢还是渲染慢？

**题解口径**

用 Chrome Performance。看 Main 线程中 Scripting、Rendering、Painting 占比；看是否有 Long Task；看 Layout 和 Recalculate Style 是否频繁；结合 React Profiler 判断组件 render 是否过重。

## 蚂蚁 / 阿里风格

### 1. 中后台系统如何做缓存策略？

**题解口径**

HTML 通常不长期强缓存，保证入口能更新。带 hash 的 JS/CSS/图片可以长期强缓存。接口数据根据业务一致性决定缓存策略。CDN 缓存要有刷新机制。Service Worker 要谨慎，避免旧资源难以失效。

### 2. 线上用户反馈页面白屏，怎么排查？

**题解口径**

先看监控：JS 错误、资源加载失败、接口失败、白屏检测、版本分布。再看发布记录、CDN、sourcemap、用户环境。常见原因包括入口资源 404、JS 运行错误、兼容性问题、接口异常未兜底、缓存旧 HTML 指向新资源失败。

### 3. Web Vitals 怎么落地到团队？

**题解口径**

采集 FCP、LCP、CLS、INP、TTFB，按页面、版本、地区、设备聚合，设置阈值和告警。优化时结合真实用户数据和实验室分析，不能只看一次 Lighthouse。

### 4. 页面安全怎么系统治理？

**题解口径**

从编码规范、组件封装、依赖扫描、CSP、Cookie 策略、权限校验、接口鉴权、审计日志和发布检查多层处理。前端负责降低风险和减少暴露面，最终安全边界必须在服务端。
