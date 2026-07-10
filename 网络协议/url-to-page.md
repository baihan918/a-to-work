# 从输入 URL 到页面展示

## 总览

从输入 URL 到页面展示，大致经历这些阶段：

```txt
解析 URL
查找缓存
DNS 解析
建立 TCP/TLS 连接
发送 HTTP 请求
服务器处理并返回响应
选择或创建渲染进程
浏览器解析 HTML/CSS/JS
布局、绘制、合成
页面展示
```

一句话总结：

浏览器先解析地址、查缓存、通过 DNS 找到服务器 IP、建立连接并发送 HTTP 请求；拿到响应后，浏览器会选择或创建合适的渲染进程，再由渲染进程解析 HTML、CSS、JavaScript，最后经过布局、绘制、合成，把页面显示到屏幕上。

如果以 Chrome 为例，可以先记住几个核心进程：

- Browser 进程：负责地址栏、标签页管理、导航调度、安全策略、进程管理等。
- Network Service：负责网络请求、缓存、连接复用、协议处理等，通常运行在独立进程中。
- Renderer 进程：负责页面里的 HTML/CSS/JavaScript 解析执行、DOM、样式计算、布局、绘制等。
- GPU 进程：负责图层合成、栅格化、和系统图形能力交互。

所以这道题不只是“网络请求 + 页面渲染”，还包含一个很重要的点：**浏览器会在导航过程中决定这个页面由哪个 Renderer 进程承载**。

## 1. 解析 URL

例如输入：

```txt
https://www.example.com/index.html
```

浏览器会解析出：

- 协议：`https`。
- 域名：`www.example.com`。
- 路径：`/index.html`。
- 端口：`https` 默认端口是 `443`，`http` 默认端口是 `80`。

## 2. 查找缓存

浏览器会先判断本地是否有可用缓存。

常见情况：

- 强缓存命中：直接使用本地缓存，不发送网络请求，开发者工具里通常显示 `200 OK (from memory cache)` 或 `200 OK (from disk cache)`。
- 协商缓存：向服务器确认资源是否变化。如果资源没有变化，服务器返回 `304 Not Modified`，浏览器继续使用本地缓存。
- 没有缓存或缓存失效：发起完整网络请求。

所以缓存相关状态可以这样记：

```txt
强缓存命中：200 from memory cache / disk cache，不真正发请求
协商缓存命中：304 Not Modified，会发请求向服务器确认
缓存未命中：正常请求资源，通常返回 200 OK
```

## 3. DNS 解析

浏览器需要把域名解析成 IP 地址：

```txt
www.example.com -> 服务器 IP
```

常见查找顺序：

```txt
浏览器 DNS 缓存
操作系统 DNS 缓存
hosts 文件
本地 DNS 服务器
根域名服务器
顶级域名服务器
权威域名服务器
```

DNS 解决的问题是：通过域名找到目标服务器的 IP 地址。

## 4. 建立连接

拿到 IP 后，浏览器和服务器建立连接。

如果是 `HTTP`：

```txt
TCP 三次握手
```

如果是 `HTTPS`：

```txt
TCP 三次握手
TLS 握手
```

`TCP` 负责建立可靠连接，`TLS` 负责证书校验、密钥协商和加密通信。

## 5. 发送 HTTP 请求

连接建立后，浏览器发送 HTTP 请求。

示例：

```http
GET /index.html HTTP/1.1
Host: www.example.com
Cookie: ...
User-Agent: ...
```

请求中可能包含：

- 请求方法：例如 `GET`、`POST`。
- 请求头：例如 `Host`、`Cookie`、`User-Agent`。
- 请求体：例如表单数据或 JSON 数据。

## 6. 服务器处理并返回响应

服务器收到请求后，会根据路径、参数、Cookie 等信息处理请求，然后返回响应。

示例：

```http
HTTP/1.1 200 OK
Content-Type: text/html
```

响应内容可能是：

- HTML。
- CSS。
- JavaScript。
- 图片。
- 字体。
- JSON 数据。

## 7. 选择或创建渲染进程

Chrome 拿到响应后，会根据当前导航、响应头、安全策略和站点隔离策略，决定使用哪个 Renderer 进程来加载页面。

这里要区分两个概念：

- same-origin：同源，协议、域名、端口都相同。
- same-site：同站点，通常看 scheme + registrable domain，例如 `https://a.example.com` 和 `https://b.example.com` 一般属于同一个 site：`https://example.com`。

在 Chrome 的 Site Isolation 策略下：

- 跨站点页面通常会被隔离到不同 Renderer 进程中。
- 同站点页面通常可以复用已有 Renderer 进程。
- 但“同站点一定共用一个渲染进程”不严谨，Chrome 还会受内存、标签页数量、扩展、COOP/COEP、安全策略、页面类型等因素影响。
- 如果链接使用了 `rel="noopener noreferrer"`，即使是同站点新页面，也可能不会复用原来的 Renderer 进程。

更准确的说法是：

```txt
同一个浏览上下文中，同站点导航通常可以复用 Renderer 进程；
跨站点导航更倾向于切换到新的 Renderer 进程，以满足站点隔离。
```

例如：

```txt
https://a.example.com/page1
https://b.example.com/page2
```

它们通常属于同一个 site，Chrome 可能复用同一个 Renderer 进程。

而：

```txt
https://example.com
https://another.com
```

属于跨站点导航，Chrome 通常会使用不同的 Renderer 进程。

还有一种常见例外是新窗口链接：

```html
<a
  target="_blank"
  rel="noopener noreferrer"
  href="https://linkmarket.aliyun.com/hardware_store"
>
  硬件商城
</a>
```

`target="_blank"` 会在新的标签页或窗口中打开页面。默认情况下，新页面可能通过 `window.opener` 拿到打开它的父页面窗口引用。

`rel="noopener"` 的作用是切断这个关系：

```txt
新页面无法通过 window.opener 访问父页面
父页面和新页面不需要保留可互相访问的脚本关系
```

这样做主要是为了安全。否则恶意页面可以通过 `window.opener` 操作父页面，例如把父页面跳转到伪造登录页，形成钓鱼风险。

`rel="noreferrer"` 在 `noopener` 的基础上，还会让浏览器不发送 `Referer` 请求头，避免把来源页面地址暴露给新页面。

所以，当 Chrome 解析到带有 `target="_blank"` 和 `rel="noopener noreferrer"` 的链接时，它知道新打开的页面不需要访问父页面内容，也不需要和父页面共享 `window.opener` 关系。此时，即使两个页面属于同站点，Chrome 也可能选择新的 Renderer 进程承载新页面。

这类问题面试里可以这样说：

```txt
同站点页面通常可以复用 Renderer 进程，但如果是 target="_blank" 打开的新页面，并且带了 rel="noopener noreferrer"，
浏览器会切断新页面和父页面之间的 opener 关系。

由于两个页面不再需要保持可互相访问的脚本关系，Chrome 可能会让新页面走新的浏览上下文和新的 Renderer 进程选择路径，
因此实际观察上可能不会复用原来的渲染进程。
```

## 8. 解析 HTML，构建 DOM

浏览器拿到 HTML 后开始解析，生成 DOM 树。

如果解析过程中遇到外部资源，例如：

```html
<link rel="stylesheet" href="style.css">
<script src="main.js"></script>
<img src="logo.png">
```

浏览器会继续请求 CSS、JavaScript、图片等资源。

## 9. 解析 CSS，构建 CSSOM

浏览器解析 CSS，生成 CSSOM 树。

之后会把 DOM 和 CSSOM 结合，生成渲染树：

```txt
DOM + CSSOM -> Render Tree
```

渲染树只包含页面中需要渲染的节点，例如 `display: none` 的元素通常不会进入渲染树。

## 10. 执行 JavaScript

JavaScript 可能会：

- 修改 DOM。
- 修改 CSS 样式。
- 发起新的网络请求。
- 注册事件。
- 执行业务逻辑。

普通 `<script>` 会阻塞 HTML 解析，因为脚本可能会修改当前 DOM。

常见优化方式：

- `defer`：脚本下载不阻塞 HTML 解析，等 DOM 解析完成后按顺序执行。
- `async`：脚本下载不阻塞 HTML 解析，下载完成后立即执行，执行顺序不保证。

## 11. 布局、绘制、合成

浏览器根据渲染树完成页面渲染：

```txt
Layout 布局：计算元素大小和位置
Paint 绘制：绘制文字、颜色、边框、阴影等
Composite 合成：把多个图层合成最终页面
```

更细一点看：

- Layout：计算每个元素在页面中的大小和位置。
- Paint：生成绘制指令，例如文字、颜色、边框、阴影、图片等。
- Layer：某些元素会被提升为独立图层，例如使用 `transform`、`opacity`、`position: fixed`、视频、`canvas` 等场景。
- Composite：合成线程把多个图层组合起来，交给 GPU 相关能力显示到屏幕上。

最终，页面被展示到屏幕上。

## 记忆方式

可以按两条主线记：

网络阶段：

```txt
URL -> 缓存 -> DNS -> TCP/TLS -> HTTP 请求 -> HTTP 响应
```

进程阶段：

```txt
Browser 进程调度导航 -> Network Service 处理请求 -> 选择或创建 Renderer 进程 -> GPU 进程参与合成
```

渲染阶段：

```txt
HTML -> DOM
CSS -> CSSOM
DOM + CSSOM -> 渲染树 -> 布局 -> 绘制 -> 合成
```

面试里可以这样总结：

```txt
输入 URL 后，Chrome 的 Browser 进程负责导航调度，Network Service 负责网络请求；
拿到响应后，Chrome 根据站点隔离等策略选择或创建 Renderer 进程；
Renderer 进程解析 HTML/CSS/JS，生成 DOM、CSSOM 和渲染树；
最后经过布局、绘制、分层和合成，由 GPU 相关能力把页面展示出来。

同站点页面通常可以复用 Renderer 进程，跨站点页面通常会因 Site Isolation 使用不同 Renderer 进程；
但这不是绝对规则，Chrome 会结合内存、安全策略、扩展、页面类型等因素动态决定。
```
