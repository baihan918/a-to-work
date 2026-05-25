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
浏览器解析 HTML/CSS/JS
布局、绘制、合成
页面展示
```

一句话总结：

浏览器先解析地址、查缓存、通过 DNS 找到服务器 IP、建立连接并发送 HTTP 请求，拿到资源后解析 HTML、CSS、JavaScript，最后经过布局、绘制、合成，把页面显示到屏幕上。

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

## 7. 解析 HTML，构建 DOM

浏览器拿到 HTML 后开始解析，生成 DOM 树。

如果解析过程中遇到外部资源，例如：

```html
<link rel="stylesheet" href="style.css">
<script src="main.js"></script>
<img src="logo.png">
```

浏览器会继续请求 CSS、JavaScript、图片等资源。

## 8. 解析 CSS，构建 CSSOM

浏览器解析 CSS，生成 CSSOM 树。

之后会把 DOM 和 CSSOM 结合，生成渲染树：

```txt
DOM + CSSOM -> Render Tree
```

渲染树只包含页面中需要渲染的节点，例如 `display: none` 的元素通常不会进入渲染树。

## 9. 执行 JavaScript

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

## 10. 布局、绘制、合成

浏览器根据渲染树完成页面渲染：

```txt
Layout 布局：计算元素大小和位置
Paint 绘制：绘制文字、颜色、边框、阴影等
Composite 合成：把多个图层合成最终页面
```

最终，页面被展示到屏幕上。

## 记忆方式

可以按两条主线记：

网络阶段：

```txt
URL -> 缓存 -> DNS -> TCP/TLS -> HTTP 请求 -> HTTP 响应
```

渲染阶段：

```txt
HTML -> DOM
CSS -> CSSOM
DOM + CSSOM -> 渲染树 -> 布局 -> 绘制 -> 合成
```

