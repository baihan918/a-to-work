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

### 2. async 和 defer 区别？

**题解口径**

`async` 下载不阻塞 HTML 解析，下载完成后立即执行，执行会阻塞解析，多个 async 脚本执行顺序不保证。`defer` 下载不阻塞解析，等 HTML 解析完成后按文档顺序执行，通常在 DOMContentLoaded 前。

### 3. preload 和 prefetch 区别？

**题解口径**

`preload` 是当前页面即将需要的高优先级资源。`prefetch` 是未来导航可能需要的低优先级资源。误用 preload 会抢占关键资源带宽。

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

### 9. XSS 怎么拿到用户信息？怎么防？

**题解口径**

攻击脚本可以读取页面可访问的 token、localStorage、DOM 信息，并以用户身份发请求。防御包括输出转义、避免危险 HTML、CSP、输入校验、依赖安全、Cookie `HttpOnly`、敏感操作二次确认。

### 10. 怎么判断一个页面是 JS 执行慢还是渲染慢？

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
