# useEffect 的执行时机

## 问题

React 在 render 阶段收集到的副作用，什么时候真正执行？

比如：

```jsx
function App() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    setCount(2);
  }, []);

  return <div>{count}</div>;
}
```

`useEffect` 里有一句 `setCount(2)`，这个更新会不会影响页面展示？

## 结论

`useEffect` 在 render 阶段只是被记录到 Fiber 上，不会在 render 阶段执行。

它真正执行的时机是 commit 阶段完成之后，也就是 React 已经把本次更新提交到宿主环境之后，再去执行 passive effects。

所以 `useEffect` 里的 `setCount(2)` 会影响页面展示，但它影响的不是当前这次 render 的结果，而是触发下一轮更新。

## 阶段过程

一次更新大致可以拆成：

```txt
render 阶段
  计算新的 Fiber 树
  对比新旧结构
  标记 DOM mutation、ref、layout effect、passive effect 等副作用
  不执行 useEffect 回调

commit 阶段
  把 DOM 变更提交到页面
  更新 ref
  执行 useLayoutEffect
  安排 useEffect

passive effects 阶段
  执行 useEffect 回调
```

对于上面的例子，执行过程通常是：

```txt
第一次 render：count = 1
第一次 commit：页面提交 <div>1</div>
执行 useEffect：setCount(2)
触发第二次 render：count = 2
第二次 commit：页面更新成 <div>2</div>
```

因此，`useEffect` 中的 `setState` 是一次新的更新，它不会修改已经完成的那次 render 结果。

## 为什么不是 render 阶段执行

render 阶段必须保持纯净。

原因是 render 阶段可能被 React 暂停、重做、丢弃。如果在 render 阶段就执行副作用，就可能出现这些问题：

1. 一次被丢弃的 render 也触发了真实副作用。
2. render 被重复执行时，副作用也被重复执行。
3. 页面还没有 commit，但外部世界已经被修改，状态会变得不一致。

所以 React 在 render 阶段只做计算和标记，不做真实副作用。

## useEffect 和 useLayoutEffect 的区别

`useEffect`：

```jsx
useEffect(() => {
  setCount(2);
}, []);
```

它在 commit 之后执行。页面可能先提交 `count = 1`，然后 effect 触发新更新，再变成 `count = 2`。

`useLayoutEffect`：

```jsx
useLayoutEffect(() => {
  setCount(2);
}, []);
```

它在 commit 阶段同步执行，时机早于浏览器绘制。如果它里面同步触发 `setState`，React 通常会立刻再 render 并提交，浏览器绘制时更可能直接看到修正后的结果。

所以：

```txt
useEffect       commit 后执行，不阻塞绘制，可能看到中间状态
useLayoutEffect commit 中同步执行，绘制前完成，可用于避免视觉闪烁
```

## 记忆方式

可以把 render 阶段理解成“算草稿”：

```txt
只计算，不动真实世界
```

可以把 commit 阶段理解成“发布结果”：

```txt
真正改 DOM，执行布局相关副作用，安排普通副作用
```

`useEffect` 则是发布之后再处理的普通副作用：

```txt
render 收集
commit 后执行
effect 里的 setState 触发下一轮 render
```
