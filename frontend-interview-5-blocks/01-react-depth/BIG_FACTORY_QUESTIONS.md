# React 深度：大厂追问题库

## 字节风格

### 1. React 为什么要引入 Fiber？如果没有 Fiber 会有什么问题？

**考察点**

调度、可中断渲染、主线程竞争、链表结构、render/commit。

**题解口径**

没有 Fiber 时，React 更新更接近同步递归，组件树大时一次 render 会长时间占用主线程。Fiber 把每个组件对应为可恢复的工作单元，通过 `child/sibling/return` 链表结构让 React 能暂停、恢复、丢弃低优先级工作。它真正解决的是渲染调度问题，不只是 diff 快一点。

**继续追问**

**追问 1：render 阶段为什么能中断？**

render 阶段主要是在内存里构建 work-in-progress Fiber 树，计算组件输出和副作用列表，还没有真正改 DOM。既然用户还看不到中间结果，React 就可以在这个阶段暂停、让出主线程、之后继续，甚至丢弃这次计算重新开始。

**追问 2：commit 阶段为什么不能中断？**

commit 阶段会真实修改 DOM、更新 ref、执行 layout effect。如果中断，页面可能处于一半新状态、一半旧状态，用户会看到不一致 UI。所以 commit 要一次性完成，保持界面原子提交。

**追问 3：Fiber 和虚拟 DOM 是什么关系？**

虚拟 DOM 更偏向描述 UI 的 React Element，是一次 render 返回的对象结构。Fiber 是 React 内部用于调度和更新的工作单元，保存组件类型、props、state、effect、优先级、父子兄弟关系等信息。可以理解为 React Element 描述“要渲染什么”，Fiber 描述“这个更新工作怎么被执行和调度”。

**追问 4：Fiber 如何支持优先级？**

React 会给不同更新分配不同优先级。输入、点击这类交互优先级高，列表刷新、搜索结果这类可以较低。Fiber 节点上会记录相关优先级信息，调度器根据优先级决定先处理哪些工作，低优先级工作可以被高优先级更新打断或重做。

### 2. React diff 为什么是同层比较？移动到不同父节点会怎样？

**题解口径**

React 选择启发式 diff 来换取性能。同层比较能把复杂度控制在 UI 场景可接受范围。跨层移动不会被识别为移动，通常会销毁旧节点再创建新节点。

**注意点**

不要回答成“React diff 很智能，会找到所有最小移动”。React 不追求全局最优 diff。

### 3. key 相同但组件类型不同会复用吗？

**题解口径**

不会。React 先看元素类型，不同类型通常直接卸载旧树、创建新树。key 主要在同层同类型或同一列表结构中帮助识别稳定身份。

### 4. setState 连续调用三次会 render 几次？

**题解口径**

要看 React 版本、调用位置和是否在批处理上下文。React 18 后自动批处理范围扩大，React 事件、Promise、setTimeout 等场景中的多次更新通常会合并为一次 render。依赖旧值时要用函数式更新，否则多次 `setCount(count + 1)` 可能都基于同一个快照。

### 5. useEffect 里请求接口，组件卸载后返回了怎么办？

**题解口径**

要在 cleanup 中取消或忽略旧请求。可以用 `AbortController`、请求 id、ignore flag，或者交给 React Query / SWR 管理。重点是避免卸载后 setState，以及避免旧请求覆盖新请求。

### 6. 为什么 useRef 改变不触发 render？那它适合存什么？

**题解口径**

ref 是挂在 Fiber 上的稳定对象，修改 `current` 不进入更新队列，所以不触发 render。适合存 DOM 引用、定时器 id、最新值快照、上一次值、不会直接影响 UI 的可变对象。

### 7. React.memo 包了为什么还重复渲染？

**题解口径**

常见原因是 props 浅比较失败，例如父组件每次创建新的对象、数组、函数；子组件消费的 context 变化；组件自身 state 变化；或者开发环境 StrictMode 导致额外执行。解决要稳定引用、拆 context、降低父组件更新范围，而不是盲目 memo。

### 8. startTransition 能不能包输入框 value 更新？

**题解口径**

不适合。受控输入的 value 更新是紧急更新，应该立即响应。适合 transition 的是搜索结果、复杂列表、图表刷新等非紧急更新。

### 9. Suspense 能不能替代所有 loading？

**题解口径**

不能。Suspense 适合组件渲染依赖尚未准备好时的声明式等待，比如 lazy、框架级数据读取、流式渲染。普通业务 loading、按钮提交态、局部异步状态仍然需要显式管理。

### 10. 手写一个 usePrevious

**参考实现**

```tsx
function usePrevious<T>(value: T): T | undefined {
  const ref = React.useRef<T>();

  React.useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}
```

**追问点**

**追问 1：为什么用 ref？**

因为 ref 的对象引用在多次 render 间保持稳定，修改 `ref.current` 不会触发重新渲染，适合保存“上一次值”这种不直接驱动 UI 的数据。

**追问 2：为什么在 effect 里赋值？**

effect 在本次渲染提交后执行。组件 render 时先返回上一次保存在 ref 里的值，提交后再把当前 value 写入 ref，这样下一次 render 读到的就是上一次 value。

**追问 3：首次返回什么？**

首次 render 时 ref 还没有在 effect 中写入，所以返回 `undefined`。如果业务需要默认值，可以给 hook 增加 initialValue 参数。

## 蚂蚁 / 阿里风格

### 1. 复杂中后台页面里，React 状态怎么分层？

**题解口径**

分为服务端状态、页面 UI 状态、业务流程状态和表单状态。服务端状态交给请求缓存或数据层，UI 状态局部维护，流程状态用 reducer 或状态机，表单状态交给表单层管理。不要把所有状态塞到全局 store。

### 2. 组件库 API 怎么设计？

**题解口径**

基础组件关注稳定、可组合、可访问性和主题。业务组件关注场景复用。API 要少而稳定，优先组合，不要布尔 props 爆炸。复杂扩展用 slots、render props、配置对象或 compound components。

### 3. 如何治理 React 项目重复渲染？

**题解口径**

先用 Profiler 定位，再分类处理：状态下沉、拆组件边界、稳定 props、memo 重组件、拆分 Context、虚拟滚动、缓存重计算、避免父组件无意义更新。

### 4. React 项目如何做错误兜底？

**题解口径**

渲染错误用 ErrorBoundary，异步和事件错误需要 try/catch、Promise catch 或全局监听。请求错误在请求层统一处理，页面级提供空态/错误态/重试。线上结合错误监控、sourcemap、版本号和用户链路定位。

### 5. 如何把 React 机制讲到项目价值？

**答法模板**

> 我不是为了用某个 API 而优化，而是先用 Profiler 定位到某次交互触发了大范围 render。然后根据 React 的状态更新和 memo 机制，把高频状态下沉，把列表行 memo，稳定 columns 和 handlers。最终交互延迟下降，页面可维护性也变好。
