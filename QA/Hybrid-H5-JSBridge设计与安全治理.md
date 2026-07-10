# Hybrid H5 JSBridge 设计与安全治理

## 1. JSBridge 是什么

JSBridge 本质是 H5 和 Native 之间的双向通信协议层。

它不只是让 H5 能调用 Native 方法，更重要的是解决这些问题：

- H5 和 Native 如何统一通信。
- 异步调用如何匹配回调。
- Native 如何主动通知 H5。
- 不同 App 版本如何做能力兼容。
- 回调、监听、异步任务如何防止泄漏。
- 如何防止任意网页调用高权限 Native 能力。
- 调用链路如何监控、降级和排查问题。

一句话：

> JSBridge 应该被设计成可控、可观测、可降级、可演进的协议层，而不是简单暴露一个 Native 方法调用入口。

## 2. 整体分层设计

推荐结构：

```text
H5 业务代码
  ↓
JSBridge SDK
  ↓
协议封装层
  ↓
平台通道适配层
  ↓
Native Bridge 分发层
  ↓
Native 能力模块
```

H5 业务不应该直接调用底层通道：

```js
window.webkit.messageHandlers.xxx.postMessage()
window.NativeBridge.xxx()
```

而应该统一收敛成 SDK：

```js
bridge.call('user.getInfo', {
  withToken: true
})
```

这样 Android、iOS、不同容器的差异都可以封装在 SDK 和 Native 分发层里。

## 3. 通信协议设计

一次 JSBridge 调用应该包含明确的请求 ID、能力名、参数和超时时间。

H5 请求：

```js
{
  id: 'bridge_10001',
  module: 'user',
  method: 'getInfo',
  params: {
    withToken: true
  },
  timeout: 5000
}
```

Native 返回：

```js
{
  id: 'bridge_10001',
  code: 0,
  message: 'success',
  data: {
    userId: '123',
    name: 'Tom'
  }
}
```

核心字段：

| 字段 | 作用 |
|---|---|
| `id` | 匹配请求和回调 |
| `module` | 能力分组，比如 user、pay、share |
| `method` | 具体能力方法 |
| `params` | 调用参数 |
| `timeout` | 防止无限等待 |
| `code` | 统一错误码 |
| `message` | 错误信息 |
| `data` | 返回数据 |

## 4. 异步回调设计

H5 调 Native 大多数是异步的，比如登录、支付、定位、扫码、选择图片。

H5 SDK 可以封装成 Promise：

```js
class JSBridge {
  constructor() {
    this.callbacks = new Map()
    this.events = new Map()
    this.id = 0
  }

  call(method, params = {}, options = {}) {
    const id = `bridge_${Date.now()}_${this.id++}`
    const timeout = options.timeout || 5000

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.callbacks.delete(id)
        reject({
          code: 'BRIDGE_TIMEOUT',
          message: `${method} timeout`
        })
      }, timeout)

      this.callbacks.set(id, {
        resolve,
        reject,
        timer,
        method,
        createdAt: Date.now()
      })

      this.postMessage({
        id,
        method,
        params
      })
    })
  }

  receive(message) {
    const callback = this.callbacks.get(message.id)
    if (!callback) return

    clearTimeout(callback.timer)
    this.callbacks.delete(message.id)

    if (message.code === 0) {
      callback.resolve(message.data)
    } else {
      callback.reject(message)
    }
  }

  postMessage(payload) {
    // iOS / Android 通道适配
  }
}
```

Native 执行完成后，回调 H5：

```js
window.JSBridge.receive({
  id: 'bridge_10001',
  code: 0,
  data: {}
})
```

## 5. Native 主动通知 H5

JSBridge 不只是 H5 调 Native，也包括 Native 主动通知 H5。

常见事件：

- 登录态变化。
- 网络状态变化。
- App 进入前台或后台。
- 页面返回事件。
- 定位权限变化。
- 支付结果。
- 扫码结果。

SDK 可以提供事件机制：

```js
bridge.on('app.resume', () => {
  // App 回到前台
})

bridge.on('network.change', (data) => {
  // 网络变化
})
```

实现上应该返回取消订阅函数：

```js
on(eventName, handler) {
  if (!this.events.has(eventName)) {
    this.events.set(eventName, new Set())
  }

  const handlers = this.events.get(eventName)
  handlers.add(handler)

  return () => {
    handlers.delete(handler)

    if (handlers.size === 0) {
      this.events.delete(eventName)
    }
  }
}
```

React 中使用：

```js
useEffect(() => {
  const off = bridge.on('app.resume', refreshData)

  return () => {
    off()
  }
}, [])
```

## 6. 回调如何防泄漏

JSBridge 常见泄漏来源：

- H5 发起 `bridge.call` 后，Native 没有回调。
- callback 一直留在 Map 里。
- 页面已经销毁，但回调还挂着。
- 事件监听 `on` 后没有 `off`。
- 长生命周期事件被重复注册。
- Native 保存 callbackId，WebView 销毁后仍然尝试回调。

### 6.1 每个 call 必须有 timeout

Native 不回调时，H5 侧要自动超时清理：

```js
const timer = setTimeout(() => {
  this.callbacks.delete(id)
  reject({
    code: 'BRIDGE_TIMEOUT',
    message: `${method} timeout`
  })
}, timeout)
```

### 6.2 收到回调后立即删除

```js
receive(message) {
  const callback = this.callbacks.get(message.id)
  if (!callback) return

  clearTimeout(callback.timer)
  this.callbacks.delete(message.id)

  if (message.code === 0) {
    callback.resolve(message.data)
  } else {
    callback.reject(message)
  }
}
```

重点是：

```text
resolve/reject 前后都要确保 delete
```

避免 Promise 已完成，但 callback 仍然留在 Map 里。

### 6.3 页面卸载时统一清理

页面关闭、路由切换、WebView 销毁时，要主动清理 pending callbacks 和事件监听：

```js
destroy() {
  for (const [, callback] of this.callbacks) {
    clearTimeout(callback.timer)
    callback.reject({
      code: 'PAGE_DESTROYED',
      message: 'Page destroyed before bridge callback'
    })
  }

  this.callbacks.clear()
  this.events.clear()
}
```

可以绑定：

```js
window.addEventListener('pagehide', () => {
  bridge.destroy()
})
```

SPA 内部也可以在页面组件卸载时清理当前页面作用域内的调用。

### 6.4 区分一次性调用和长期订阅

一次性能力适合 `call + Promise + timeout`：

- `getUserInfo`
- `scanQRCode`
- `chooseImage`
- `pay`

长期订阅适合 `subscribe/unsubscribe`：

- `network.change`
- `location.watch`
- `app.resume`
- `keyboard.change`

不要把长期订阅伪装成普通 callback，否则很容易泄漏。

### 6.5 Native 侧也要清理

Native 也可能泄漏。Native 侧需要做到：

- WebView destroyed 后清理 pending callbacks。
- 页面关闭后取消定位、扫码、监听器等异步任务。
- 回调前判断 WebView 是否还存活。
- 同一个 callbackId 只允许回调一次，除非它是订阅型事件。
- 长期订阅要支持取消订阅。

## 7. 能力管理和版本兼容

不能默认所有 Native 版本都支持某个能力。

可以提供能力查询：

```js
const capabilities = await bridge.call('system.getCapabilities')

if (capabilities.includes('share.openPanel.v2')) {
  bridge.call('share.openPanel.v2', params)
} else {
  bridge.call('share.openPanel', fallbackParams)
}
```

也可以封装：

```js
if (bridge.canIUse('pay.createOrder')) {
  bridge.call('pay.createOrder', params)
}
```

Native 返回能力列表：

```json
{
  "containerVersion": "8.5.0",
  "bridgeVersion": "2.3.0",
  "capabilities": [
    "user.getInfo",
    "share.openPanel",
    "pay.createOrder",
    "device.getLocation"
  ]
}
```

这样可以避免：

```text
新 H5 调了新 Bridge
但用户 App 还是旧版本
导致页面白屏或功能不可用
```

## 8. 如何防止任意原生能力调用

JSBridge 是高权限通道，不能让任意网页调用任意 Native 能力。

重点是：

> 权限边界必须放在 Native 侧，不能只依赖 H5 SDK 限制。前端代码可以被绕过，Native 才是真正的安全执行方。

### 8.1 域名和来源校验

Native 收到 Bridge 调用时，要先判断当前 WebView URL：

- 当前页面 origin 是否可信。
- 当前页面是否来自公司域名。
- 是否命中可信离线包 appId。
- 是否为允许调用 Bridge 的页面。

注意要校验 origin，不要只做字符串包含：

```text
https://evil.com?redirect=https://m.example.com 不能通过
https://m.example.com.evil.com 不能通过
```

### 8.2 能力白名单

可信域名也不应该能调用所有能力。应该按业务、页面、appId 配置能力白名单：

| 页面/业务 | 可调用能力 |
|---|---|
| 商品详情 | share、openSchema、getNetwork |
| 订单页 | getUserInfo、pay、openSchema |
| 营销页 | share、copyText |
| 第三方页 | 不开放敏感能力，只开放极少基础能力 |

配置示例：

```json
{
  "order-detail": [
    "user.getInfo",
    "pay.createOrder",
    "device.getNetwork",
    "router.open"
  ],
  "marketing-page": [
    "share.openPanel",
    "clipboard.copy",
    "router.open"
  ]
}
```

Native 执行前判断：

```text
当前 appId 是否允许调用 module.method
```

### 8.3 敏感能力二次校验

敏感能力不能只靠白名单：

- 支付。
- 下单。
- 打开外部 App。
- 读取通讯录。
- 定位。
- 相册。
- 摄像头。
- 剪贴板。
- 文件系统。
- 账号 token。
- 设备唯一标识。

还需要：

- 用户授权。
- 登录态校验。
- 业务 token。
- 签名 sign。
- 一次性 nonce。
- 服务端校验。
- 风控校验。

比如支付能力，H5 不应该直接传金额让 Native 支付：

```text
错误方式：H5 -> Native: pay({ amount: 100 })
正确方式：H5 -> 服务端创建订单 -> Native 只拿 orderToken 调支付
```

### 8.4 Native 参数校验

Native 不能信任 H5 传参。

需要校验：

- 参数类型。
- 必填字段。
- 枚举范围。
- URL scheme 是否安全。
- 文件路径是否合法。
- 金额、订单号等是否来自可信服务端。

比如打开 URL：

```text
只允许 http/https 或公司白名单 scheme
禁止 javascript:
禁止 file:
禁止 intent: 非白名单跳转
```

### 8.5 避免万能 invoke

不要暴露这种万能方法：

```js
bridge.call('native.invoke', {
  className: 'UserManager',
  methodName: 'getToken',
  params: {}
})
```

这类设计风险很高，相当于把 Native 反射能力交给 H5。

更好的方式是显式注册能力：

```text
user.getInfo
share.openPanel
pay.createOrder
device.getLocation
router.open
```

每个能力都要有明确的：

- 入参。
- 出参。
- 权限。
- 错误码。
- 降级策略。
- 监控埋点。

### 8.6 离线包签名和完整性校验

如果 H5 来自离线包，还要防止离线包被篡改：

- manifest 签名。
- 资源 hash 校验。
- HTTPS 下载。
- 包来源校验。
- 本地文件完整性校验。

否则攻击者如果能替换本地包，就可能借助高权限 Bridge 调用敏感能力。

### 8.7 日志审计和监控

敏感能力要记录：

- 哪个 appId。
- 哪个 URL。
- 哪个用户。
- 调用了哪个能力。
- 调用时间。
- 参数摘要。
- 结果码。
- Native 版本。
- 离线包版本。

一旦出现异常调用，可以快速定位、封禁和回滚。

## 9. 统一错误码和降级

Bridge 调用要有统一错误码：

| 错误类型 | 示例 |
|---|---|
| 不支持能力 | `BRIDGE_NOT_SUPPORT` |
| 超时 | `BRIDGE_TIMEOUT` |
| 用户取消 | `USER_CANCEL` |
| 权限拒绝 | `PERMISSION_DENIED` |
| 参数错误 | `INVALID_PARAMS` |
| Native 异常 | `NATIVE_ERROR` |
| 网络异常 | `NETWORK_ERROR` |
| 页面销毁 | `PAGE_DESTROYED` |

H5 侧要能区分不同错误：

```js
try {
  await bridge.call('scanQRCode')
} catch (err) {
  if (err.code === 'USER_CANCEL') {
    return
  }

  if (err.code === 'BRIDGE_NOT_SUPPORT') {
    // 降级到 H5 方案或提示升级 App
  }
}
```

## 10. 初始化时机

不要让页面强依赖 Bridge ready 才能渲染。

不推荐：

```text
await bridge.ready()
await bridge.call('user.getInfo')
renderPage()
```

这种会把首屏卡死。

更好的方式：

```text
页面基础内容先渲染
Bridge ready 后补充 Native 能力
关键能力设置超时和降级
```

例如：

- 首屏框架和骨架先展示。
- 用户信息异步补齐。
- 分享配置异步注册。
- 设备能力异步获取。
- 强依赖 Native 的功能单独处理 loading、超时和错误态。

## 11. 面试表达

可以这样回答：

> JSBridge 我会设计成 H5 和 Native 之间统一的协议层，而不是让业务直接调用系统通道。H5 侧提供 JSBridge SDK，统一封装 call、on、ready、canIUse；协议里用 requestId 匹配异步回调，用 module/method 做能力分组，用 code/message/data 统一返回。Native 侧按模块注册能力，并做白名单、权限、参数校验。版本兼容上通过 bridgeVersion 和 capabilities 做能力协商，避免新 H5 调旧 Native 不支持的方法。错误处理上要有超时、取消、不支持、权限拒绝等统一错误码。

关于回调防泄漏：

> 回调防泄漏，我会把 JSBridge 调用分成一次性调用和长期订阅。一次性调用用 requestId + Promise + timeout 管理，收到回调后立即清理，超时也清理；页面销毁时 reject 所有 pending callbacks，并清空事件监听。长期订阅必须返回 unsubscribe，组件卸载时取消。Native 侧也要在 WebView 销毁时清理异步任务，回调前判断页面是否存活。

关于防止任意原生能力调用：

> 防止任意原生能力调用，核心限制必须放在 Native 侧。Native 收到调用后要校验当前 origin、离线包 appId、能力白名单和用户权限；敏感能力还要做参数校验、用户授权、业务 token 或服务端校验。能力设计上避免暴露万能 invoke 或反射调用，只开放明确的 module.method，并配合离线包签名、资源 hash、日志审计和异常监控。这样 JSBridge 才是一个可控的协议层，而不是一个高权限后门。

一句话总结：

> JSBridge 的关键不是打通 H5 和 Native，而是把通信协议、回调生命周期、能力版本、安全权限和异常降级都收敛到统一治理里。
