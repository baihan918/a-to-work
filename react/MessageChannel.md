# React MessageChannel 原理

## 要不要准备？

需要准备，但不用准备到源码级背诵。

对 9 年前端、面 AI 方向或大厂高级前端岗位来说，`MessageChannel` 属于 React 调度机制里的高级追问点。它通常不会单独作为主问题出现，但很容易在这些问题后面被追问：

- React 为什么需要 Scheduler？
- Fiber 为什么可以中断和恢复？
- Concurrent Rendering / 时间切片是怎么做的？
- React 为什么不用 `setTimeout` 或 `Promise.then` 来调度？
- `useEffect`、批处理、优先级更新背后的调度机制是什么？

面试准备目标不是背源码，而是能讲清楚：

> `MessageChannel` 是 React Scheduler 在浏览器环境中用于安排下一轮任务执行的一种异步调度手段。它的价值是让 React 可以把长渲染任务拆成小块执行，并在合适时机让出主线程，避免页面长时间卡顿。

---

## 一句话结论

`MessageChannel` 不是 React 并发能力的核心，但它是 React Scheduler 实现异步分片调度的重要底层工具之一。

可以这样理解：

```txt
Fiber：把一次大渲染拆成很多小的 work unit
Scheduler：决定这些 work unit 什么时候执行、是否让出主线程
MessageChannel：通知浏览器“下一轮继续执行任务”的底层异步机制之一
```

---

## 背景：React 为什么需要调度？

浏览器里 JS 执行、样式计算、布局、绘制、用户输入响应，很多工作都在主线程上竞争执行。

如果 React 一次更新里要处理大量组件，并且从头到尾同步执行完，主线程会被长时间占用。这期间浏览器没办法及时响应：

- 点击
- 输入
- 滚动
- 动画
- 页面绘制

所以 React Fiber 把渲染工作拆成一个个小的任务单元。Scheduler 会一边执行这些单元，一边判断当前是否应该让出主线程。

如果时间不够了，React 会暂停当前渲染工作，把控制权交还给浏览器。等下一轮调度机会到来，再继续执行剩余任务。

这就是 React 能实现“可中断、可恢复、按优先级调度”的基础。

---

## MessageChannel 是什么？

`MessageChannel` 是浏览器提供的通信 API，可以创建两个互相通信的端口：`port1` 和 `port2`。

最简单的用法如下：

```js
const channel = new MessageChannel();

channel.port1.onmessage = () => {
  // 异步执行任务
  console.log('run task');
};

channel.port2.postMessage(null);
```

当调用 `port2.postMessage(null)` 后，`port1.onmessage` 不会同步执行，而是会在后续事件循环中异步触发。

React Scheduler 正是利用这个特性，把“继续执行任务”的逻辑安排到下一轮事件循环中。

---

## React Scheduler 中的大概流程

简化后的流程可以理解为：

```txt
产生更新
  ↓
创建调度任务
  ↓
任务进入 Scheduler 队列
  ↓
通过 MessageChannel 安排一次异步回调
  ↓
浏览器触发 onmessage
  ↓
执行 workLoop
  ↓
处理 Fiber work unit
  ↓
判断 shouldYieldToHost
  ↓
时间不够则让出主线程
  ↓
没做完则继续安排下一轮任务
```

关键点是：React 不是一次性把所有 Fiber 都处理完，而是边处理边判断是否需要暂停。

---

## 为什么不用 Promise 微任务？

这是面试里很容易被追问的点。

`Promise.then` 属于微任务。微任务会在当前宏任务结束后立即执行，并且浏览器通常要等微任务队列清空后，才有机会进行渲染。

如果 React 用微任务来不断调度自己，例如：

```js
Promise.resolve().then(workLoop);
```

如果 `workLoop` 里继续塞新的微任务，就可能导致微任务队列一直被 React 占用，浏览器很难插入渲染、输入响应等工作。

这样反而违背了 React 调度的目标。

React 需要的是：

- 不要同步阻塞主线程
- 不要像微任务一样连续抢占渲染机会
- 能比较及时地安排下一轮任务

所以 `Promise.then` 不适合作为 React Scheduler 的主要分片调度方式。

---

## 为什么不用 setTimeout？

`setTimeout(fn, 0)` 也可以异步执行，但它的问题是调度不够稳定。

主要原因包括：

- `setTimeout(fn, 0)` 并不是真正的 0ms
- 浏览器对嵌套的 `setTimeout` 可能有最小延迟限制
- 触发时机不如 `MessageChannel` 稳定
- 高频时间切片场景下，延迟会影响调度体验

React Scheduler 需要的是一种比 `setTimeout` 更及时、更稳定，同时又不像微任务那样阻塞浏览器渲染的机制。

`MessageChannel` 刚好是一个折中方案。

---

## MessageChannel、Promise、setTimeout 的区别

| 方式 | 类型 | 特点 | 是否适合 React Scheduler |
| --- | --- | --- | --- |
| `Promise.then` | 微任务 | 当前宏任务结束后立即执行，微任务队列清空前浏览器通常不能渲染 | 不适合，容易阻塞渲染机会 |
| `setTimeout` | 宏任务 | 有最小延迟，嵌套调用可能被 clamp | 可用但不够稳定 |
| `MessageChannel` | 类宏任务调度 | 异步、延迟较低、比 setTimeout 更稳定 | 更适合浏览器环境下的 Scheduler |

---

## 和 Fiber 的关系

Fiber 解决的是“任务怎么拆”的问题。

Scheduler 解决的是“任务什么时候执行”的问题。

MessageChannel 解决的是“怎么通知下一轮继续执行”的问题。

三者关系可以这样说：

> Fiber 把组件更新过程拆成多个可中断的执行单元，Scheduler 根据优先级和时间片控制这些单元的执行节奏，而 MessageChannel 是 Scheduler 在浏览器中安排下一轮异步执行的一种底层机制。

所以不要把 `MessageChannel` 说成 React 并发能力的核心。它只是底层调度工具之一。

React 真正的核心是：

- Fiber 数据结构
- 可中断的 render phase
- Scheduler 优先级调度
- Lane 模型
- shouldYield 判断
- commit phase 不可中断

---

## shouldYieldToHost 是什么？

Scheduler 在执行任务时，并不是无限执行下去，而是会不断判断当前是否应该让出主线程。

这个判断可以简化理解为：

```js
function workLoop() {
  while (hasWork && !shouldYieldToHost()) {
    performUnitOfWork();
  }

  if (hasWork) {
    scheduleNextWork();
  }
}
```

`shouldYieldToHost` 的作用是判断当前任务是否已经执行太久，是否应该把主线程还给浏览器，让浏览器有机会处理用户输入和页面渲染。

---

## 面试回答模板

可以这样回答：

> React 使用 Fiber 架构后，会把渲染工作拆成很多小的 work unit。Scheduler 会根据任务优先级和当前时间片情况决定是否继续执行。如果执行时间过长，就会通过 shouldYield 判断让出主线程，避免阻塞用户输入和页面渲染。
>
> 在浏览器环境下，Scheduler 通常会用 MessageChannel 来安排下一轮任务。它相比 Promise 微任务，不会一直占住渲染机会；相比 setTimeout，又有更低延迟和更稳定的调度时机。
>
> 所以 MessageChannel 不是 React 并发能力本身，但它是 Scheduler 实现异步分片调度的底层手段之一。

---

## 如果面试官继续追问

### 1. MessageChannel 是宏任务还是微任务？

可以回答：

> 它不是微任务。它的回调会作为异步任务在后续事件循环中执行，行为上更接近宏任务调度。React 使用它主要是为了避免微任务连续执行导致浏览器没有机会渲染。

不需要在面试里死磕规范分类。重点是讲清楚它和微任务的调度差异。

### 2. React 为什么不用 requestIdleCallback？

可以回答：

> `requestIdleCallback` 的触发时机受浏览器控制，不稳定，而且兼容性和执行频率都不适合作为 React 核心调度机制。React Scheduler 需要自己控制任务优先级、过期时间和让出时机，所以没有直接依赖 `requestIdleCallback`。

### 3. MessageChannel 会不会阻塞渲染？

可以回答：

> 单次 MessageChannel 回调里如果执行很重的 JS，仍然会阻塞主线程。但 React 的关键不只是用了 MessageChannel，而是在 workLoop 中配合 shouldYield，把长任务拆开执行。

### 4. MessageChannel 和 useEffect 有关系吗？

可以回答：

> 它们不是同一个概念。`useEffect` 是副作用执行时机，Scheduler 是任务调度机制。React 内部不同阶段可能会借助调度能力安排异步任务，但面试中不要简单说 useEffect 就是靠 MessageChannel 实现的，要区分概念层次。

---

## 需要看的源码关键词

不需要整份源码通读，重点看这些关键词即可：

```txt
scheduler
performWorkUntilDeadline
schedulePerformWorkUntilDeadline
MessageChannel
shouldYieldToHost
workLoop
unstable_scheduleCallback
```

理解这些关键词之间的关系，比背源码更重要。

---

## 准备优先级

对高级前端面试来说，可以按这个优先级准备：

### 必须会

- Fiber 是什么
- render phase 和 commit phase 的区别
- render phase 为什么可以中断
- commit phase 为什么不能中断
- Scheduler 的作用
- Lane 优先级模型
- 自动批处理
- `useEffect` / `useLayoutEffect` 执行时机

### 建议会

- `MessageChannel` 调度原理
- 为什么不用 `Promise.then`
- 为什么不用 `setTimeout`
- 为什么不用 `requestIdleCallback`
- `shouldYieldToHost` 的作用
- 时间切片的基本流程

### 了解即可

- Scheduler 小顶堆任务队列
- 过期时间计算
- Host callback 细节
- 不同环境下的 fallback 策略

---

## 最终记忆版

面试时记住这段即可：

> React 的并发渲染不是靠 MessageChannel 实现的，而是靠 Fiber + Scheduler。Fiber 负责把渲染拆成可中断的单元，Scheduler 负责按优先级调度这些单元。MessageChannel 只是 Scheduler 在浏览器环境里安排下一轮异步任务的一种方式。相比 Promise 微任务，它不会连续阻塞浏览器渲染；相比 setTimeout，它延迟更低、更稳定。所以它适合用来支撑 React 的时间切片调度。
