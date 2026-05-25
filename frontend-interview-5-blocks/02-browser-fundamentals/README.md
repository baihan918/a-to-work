# 02 浏览器原理

## 高频面试题

### 1. 从输入 URL 到页面展示发生了什么？

**答题口径**

大流程是：URL 解析、DNS 解析、TCP 连接、TLS 握手、HTTP 请求、服务端响应、浏览器解析 HTML、构建 DOM、解析 CSS 构建 CSSOM、合成 Render Tree、Layout、Paint、Composite，期间还会加载 JS、CSS、图片、字体等子资源，并受缓存策略影响。

**注意点**

- 不要背流水账，要能解释阻塞关系。
- CSS 会阻塞渲染树构建。
- 同步 JS 会阻塞 HTML 解析，因为 JS 可能读写 DOM 和样式。
- `defer`、`async`、`preload`、`prefetch` 要能区分。

### 2. 浏览器渲染流程是什么？

**答题口径**

DOM 描述结构，CSSOM 描述样式，二者合成 Render Tree。Layout 计算盒子位置和大小，Paint 生成绘制指令，Composite 把不同图层合成到屏幕。

**注意点**

- Layout 影响几何信息，成本通常比 Paint 更高。
- `transform`、`opacity` 通常可以走合成层，动画更流畅。
- 读布局属性前如果有未提交样式变更，可能触发强制同步布局。

### 2.1 为什么 CSS 动画通常比 JavaScript 动画更高效？

**答题口径**

CSS 动画不一定永远比 JavaScript 高效，但 CSS 动画更容易被浏览器优化。浏览器知道动画的起点、终点、时长和 easing，可以提前做优化。尤其是 `transform`、`opacity` 这类属性通常不需要重新 Layout 和 Paint，只需要 Composite，甚至可以由合成线程处理。

JavaScript 动画如果每帧计算并修改样式，容易占用主线程。主线程还要处理 JS 执行、事件回调、布局计算、React render 等任务，一旦有长任务就容易掉帧。

**注意点**

- 高效的关键不是 CSS 还是 JS，而是动画属性是否避开 Layout 和 Paint。
- `transform`、`opacity` 通常更适合动画。
- `width`、`height`、`top`、`left`、`margin` 等属性可能触发布局或重绘，CSS 写也不一定高效。
- JS 动画如果用 `requestAnimationFrame` 且只改 `transform`，也可以很流畅。

**will-change 追问**

`will-change` 用来提前告诉浏览器：这个元素的某个属性接下来可能会变化，浏览器可以提前做优化准备，比如创建合成层或准备缓存。

```css
.card {
  will-change: transform, opacity;
}
```

它常用于减少动画开始瞬间的卡顿。比如一个元素马上要做 `transform` 动画，可以提前加 `will-change: transform`，让浏览器提前准备。

但 `will-change` 不是性能银弹，不能全局乱加。过多合成层会占用内存和 GPU 资源，增加合成成本，反而让页面更卡。

推荐做法是只对少量即将动画的元素使用，并在动画结束后恢复：

```js
el.style.willChange = 'transform';

requestAnimationFrame(() => {
  el.classList.add('moving');
});

el.addEventListener('transitionend', () => {
  el.style.willChange = 'auto';
});
```

**面试表达**

> CSS 动画通常更高效，是因为浏览器可以提前优化，尤其 `transform` 和 `opacity` 可以跳过 Layout 和 Paint，直接在合成层做 Composite。`will-change` 可以进一步提示浏览器提前做图层提升或缓存准备，减少动画启动时的抖动。但它不能滥用，因为合成层太多会增加内存和 GPU 压力。真正的优化关键是选择合适的动画属性，并避免主线程长任务。

### 3. 重排和重绘区别？

**答题口径**

重排是重新计算元素几何信息，例如宽高、位置、字体、内容变化。重绘是重新绘制像素，例如颜色、背景变化。重排通常会带来重绘，但重绘不一定重排。

**注意点**

- 循环里频繁读写布局会造成 layout thrashing。
- 批量读、批量写，或使用 rAF 调度 DOM 写入。

### 4. Event Loop 怎么理解？

**答题口径**

浏览器 JS 是单线程执行的。一次宏任务执行完后，会清空微任务队列，然后浏览器在合适时机执行渲染，再进入下一轮事件循环。Promise 回调属于微任务，setTimeout 属于宏任务，requestAnimationFrame 通常在下一帧绘制前执行。

**经典题**

```js
console.log(1);
setTimeout(() => console.log(2));
Promise.resolve().then(() => console.log(3));
console.log(4);
```

输出：`1 4 3 2`。

**注意点**

- 微任务过多会阻塞渲染。
- 不要把大计算塞进 Promise 以为就不会卡。

### 5. requestAnimationFrame 和 requestIdleCallback 区别？

**答题口径**

`requestAnimationFrame` 在下一帧绘制前执行，适合动画和 DOM 写入。`requestIdleCallback` 在浏览器空闲时执行，适合低优先级任务，但执行时机不稳定，不能放关键逻辑。

### 6. 浏览器缓存机制怎么讲？

**答题口径**

缓存分强缓存和协商缓存。强缓存通过 `Cache-Control`、`Expires` 判断是否直接使用缓存。协商缓存通过 `ETag` / `If-None-Match` 或 `Last-Modified` / `If-Modified-Since` 向服务端确认资源是否变化。

工程上通常 HTML 不做长期强缓存，静态资源使用 hash 文件名和长期缓存。

**注意点**

- `no-cache` 是要协商，不是不缓存。
- `no-store` 才是不存储。
- 发布后用户看到旧页面，常见原因是 HTML、CDN、Service Worker 或中间缓存未更新。

### 7. HTTP/1.1、HTTP/2、HTTP/3 区别？

**答题口径**

HTTP/1.1 有连接复用但仍存在队头阻塞。HTTP/2 使用二进制分帧、多路复用、头部压缩，适合大量小资源。HTTP/3 基于 QUIC 和 UDP，减少 TCP 层队头阻塞和握手成本。

**注意点**

- HTTP/2 下过度拆包收益变小，但缓存粒度仍然重要。
- 资源合并策略要结合协议、缓存和构建产物。

### 8. CORS 是什么？

**答题口径**

CORS 是浏览器基于同源策略的跨域访问控制机制。服务端通过响应头声明哪些源、方法、请求头可以访问。复杂请求会先发预检 OPTIONS 请求。

**注意点**

- 跨域限制主要由浏览器执行，不是服务端不能处理请求。
- 简单请求和预检请求要能区分。
- 带 Cookie 要设置 `Access-Control-Allow-Credentials`，且 origin 不能是 `*`。

### 9. XSS 和 CSRF 怎么防？

**答题口径**

XSS 是攻击者注入脚本并在用户页面执行。防御包括输入校验、输出转义、避免危险 HTML 注入、CSP、Cookie `HttpOnly`。

CSRF 是利用用户已登录态发起跨站请求。防御包括 `SameSite` Cookie、CSRF token、关键操作二次确认、校验 Origin / Referer。

**注意点**

- token 放 localStorage 会有 XSS 风险。
- `HttpOnly` 能降低 token 被脚本读取的风险，但不能防所有请求伪造。

### 10. Web Vitals 常见指标是什么？

**答题口径**

- FCP：首次内容绘制。
- LCP：最大内容绘制，衡量主要内容出现速度。
- CLS：布局偏移。
- INP：交互响应。
- TTFB：首字节时间。
- TBT：总阻塞时间。

**注意点**

- 实验室指标和真实用户指标要区分。
- Lighthouse 不等于线上真实体验。
- 需要结合 RUM 上报、Performance、Network 分析。

### 11. 页面性能：如何系统地优化页面？

**答题口径**

系统优化页面性能，不要一上来堆“懒加载、缓存、CDN”。更好的回答是按：指标定义、问题定位、分层优化、监控闭环。

**1. 先定义目标指标**

先判断问题是什么：

- 加载性能：TTFB、FCP、LCP。
- 交互性能：INP、TBT、Long Task。
- 视觉稳定性：CLS。
- 资源性能：JS/CSS 体积、图片体积、请求数量。
- 业务指标：转化率、跳出率、关键操作完成率。

面试表达：

> 我不会直接开始优化，而是先确定问题是首屏慢、交互卡、布局抖动，还是接口慢。不同问题对应的指标和手段不一样。

**2. 再做定位**

常用工具：

- Lighthouse：看整体问题和 Web Vitals。
- Chrome Performance：看主线程、Long Task、Layout、Paint。
- Network：看资源瀑布、TTFB、缓存、阻塞资源。
- Coverage：看未使用 JS / CSS。
- React Profiler：看组件重复渲染和 commit 时间。
- Bundle Analyzer：看包体积和大依赖。
- 线上 RUM：看真实用户数据，而不是只看本地环境。

面试表达：

> 实验室工具用于定位方向，线上 RUM 用来验证真实用户体验。不能只看一次 Lighthouse 分数。

**3. 加载链路优化**

目标是让关键内容更早出现。

- CDN、HTTP/2 / HTTP/3、gzip / brotli。
- HTML 不长期强缓存，静态资源 hash + 长缓存。
- 减少首屏 JS 和 CSS。
- 路由级 code splitting。
- 非首屏组件懒加载。
- 关键资源 preload。
- 未来页面资源 prefetch。
- 关键 CSS 内联或优先加载。
- 字体优化：`font-display: swap`、字体子集化、preload 字体。
- 图片优化：WebP / AVIF、响应式图片、懒加载、明确宽高。
- 减少阻塞脚本，业务脚本用 `defer` / module，第三方独立脚本用 `async`。

**4. 渲染性能优化**

目标是减少 Layout、Paint、Composite 压力。

- 避免频繁修改会触发 layout 的属性。
- 动画优先用 `transform`、`opacity`。
- 避免读写布局交错造成强制同步布局。
- 大列表虚拟滚动。
- 减少 DOM 数量。
- 避免复杂 CSS 选择器和大面积阴影、滤镜。
- 合理使用 `will-change`，动画结束后恢复。
- 控制 CLS：图片、广告、异步内容提前占位。

**5. JS 执行优化**

目标是减少主线程长任务。

- 拆分长任务。
- 大计算放 Web Worker。
- 防抖节流。
- 减少不必要的 JSON 解析和深拷贝。
- 延迟非关键 JS。
- 移除重依赖或按需加载。
- 避免微任务过多阻塞渲染。
- SSR 场景下降低 hydration 成本。

**6. React 层优化**

目标是减少无效 render 和 commit 成本。

- React Profiler 定位重复渲染。
- 状态下沉或局部化，避免父组件频繁带动整棵树。
- `React.memo` 优化重组件。
- `useMemo` 缓存重计算。
- `useCallback` 稳定传给 memo 子组件的函数。
- 拆分 Context，避免一个 Provider 更新拖动大量组件。
- 大表格虚拟滚动。
- `startTransition` 处理非紧急列表刷新。
- `Suspense` / lazy 做代码分割和加载边界。

注意：

> 不要一上来就 memo。memo 是结果优化，不是根因优化。

**7. 接口和数据层优化**

页面慢不一定都是前端资源问题。

- 接口聚合，减少瀑布请求。
- 并发请求。
- 缓存稳定数据。
- 分页、增量加载。
- 骨架屏和渐进展示。
- 请求取消，避免旧请求覆盖新数据。
- 乐观更新。
- 服务端降低 TTFB。
- CDN / 边缘缓存。

**8. 第三方脚本治理**

很多页面性能被第三方 SDK 拖垮。

- 统计、广告、客服等脚本异步加载。
- 非必要脚本延迟到首屏后。
- 设置超时和降级。
- 监控第三方脚本加载耗时和错误。
- 防止第三方脚本阻塞主线程。

**9. 建立监控闭环**

优化不是一次性动作。

- 上报 Web Vitals。
- 上报资源加载失败和耗时。
- 上报 Long Task。
- 上报 JS 错误和 Promise rejection。
- 按页面、版本、地区、设备分组。
- 建立性能预算，例如首屏 JS 体积、LCP、INP 阈值。
- 发布前 Lighthouse / Bundle 体积检查。
- 发布后看真实用户指标是否改善。

**面试总结**

> 我会按指标驱动做页面性能优化。先确定问题是加载慢、交互卡、布局抖动还是接口慢，对应看 LCP、INP、CLS、TTFB 等指标。然后用 Lighthouse、Performance、Network、React Profiler、Bundle Analyzer 和线上 RUM 定位瓶颈。优化上分层处理：加载链路减少关键资源和阻塞，渲染层减少 Layout/Paint，JS 层拆长任务和治理包体积，React 层减少无效渲染，数据层避免瀑布请求和重复请求。最后通过 Web Vitals 上报、性能预算和发布监控形成闭环，确保优化真的影响真实用户，而不是只提高本地分数。

## 项目表达模板

性能问题不要只说“我做了懒加载”，建议这样讲：

> 我先用 Lighthouse 和线上 Web Vitals 发现 LCP 偏高，再用 Network 看资源瀑布，确认首屏 JS 和图片是主要瓶颈。然后通过路由级拆包、关键图片预加载、压缩图片、延迟非首屏组件，把 LCP 从 X 秒降到 Y 秒。
