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

## 项目表达模板

性能问题不要只说“我做了懒加载”，建议这样讲：

> 我先用 Lighthouse 和线上 Web Vitals 发现 LCP 偏高，再用 Network 看资源瀑布，确认首屏 JS 和图片是主要瓶颈。然后通过路由级拆包、关键图片预加载、压缩图片、延迟非首屏组件，把 LCP 从 X 秒降到 Y 秒。

