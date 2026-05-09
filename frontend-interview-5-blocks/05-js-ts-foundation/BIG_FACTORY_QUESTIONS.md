# JS / TS 基础：大厂追问题库

## 字节风格

### 1. 输出题：Event Loop

```js
console.log('start');

setTimeout(() => {
  console.log('timeout');
});

Promise.resolve()
  .then(() => {
    console.log('then1');
    return Promise.resolve();
  })
  .then(() => {
    console.log('then2');
  });

console.log('end');
```

**答案**

`start end then1 then2 timeout`

**题解口径**

同步代码先执行，Promise then 进入微任务，setTimeout 进入后续宏任务。当前宏任务结束后清空微任务，再执行下一个宏任务。

### 2. 手写 debounce

```ts
function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
```

**追问点**

**追问 1：this 如何保留？**

返回函数不要写成箭头函数，而是用普通函数接收调用时的 `this`，再通过 `fn.apply(this, args)` 执行原函数。这样作为对象方法使用时，原函数仍能拿到正确 this。

**追问 2：如何支持立即执行？**

增加 `immediate` 参数。如果当前没有 timer 且 `immediate` 为 true，就先执行一次，然后开启 timer；timer 结束后只负责清空状态。

```ts
function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
  immediate = false
) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const shouldCallNow = immediate && !timer;

    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);
    }, delay);

    if (shouldCallNow) fn.apply(this, args);
  };
}
```

**追问 3：如何取消？**

可以给返回函数挂一个 `cancel` 方法，内部清理 timer 并重置状态。实际工程里也可以返回 `{ run, cancel }`，类型更清晰。

### 3. 手写 throttle

```ts
function throttle<T extends (...args: any[]) => void>(
  fn: T,
  interval: number
) {
  let last = 0;

  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

**追问点**

**追问 1：如何支持尾调用？**

尾调用指最后一次触发虽然没到间隔，也要在间隔结束后执行一次。可以在未满足时间间隔时设置一个 timer，保存最后一次参数，到时间后执行。

```ts
function throttleWithTrailing<T extends (...args: any[]) => void>(
  fn: T,
  interval: number
) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  return function(this: ThisParameterType<T>, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = interval - (now - last);

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(this, args);
      return;
    }

    if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
```

**追问 2：时间戳版和定时器版区别？**

时间戳版通常第一次会立即执行，但停止触发后不一定补最后一次。定时器版可以更自然地支持尾调用，但第一次是否立即执行要额外控制。工程里常暴露 leading/trailing 参数，让调用方选择。

### 4. 手写 Promise.all

```ts
function promiseAll<T>(items: Array<T | Promise<T>>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (items.length === 0) {
      resolve([]);
      return;
    }

    const results: T[] = [];
    let count = 0;

    items.forEach((item, index) => {
      Promise.resolve(item)
        .then(value => {
          results[index] = value;
          count++;
          if (count === items.length) {
            resolve(results);
          }
        })
        .catch(reject);
    });
  });
}
```

**追问点**

**追问 1：结果顺序如何保证？**

不能按完成顺序 push，而要按原数组 index 写入 `results[index]`。因为 Promise 完成顺序不确定，但 `Promise.all` 的结果顺序必须和输入顺序一致。

**追问 2：空数组怎么办？**

空数组应该立即 resolve `[]`。如果不特殊处理，计数逻辑永远不会触发 resolve。

**追问 3：失败后是否继续？**

原生 `Promise.all` 是 fail-fast：任意一个 Promise reject，返回的 Promise 立刻 reject。其他已经启动的 Promise 不会被自动取消，只是它们后续结果不会影响 `Promise.all` 的最终状态。如果要全部完成后收集成功失败，要实现类似 `Promise.allSettled`。

### 5. 手写深拷贝要考虑什么？

**题解口径**

要考虑基础类型、对象、数组、Date、RegExp、Map、Set、循环引用、Symbol key、原型、函数。业务中优先使用 `structuredClone` 或成熟库，面试手写重点是 WeakMap 处理循环引用。

### 6. 原型链和继承实现

**题解口径**

能讲清构造函数、实例、`prototype`、内部原型之间的关系。组合继承、寄生组合继承、class 本质都要能讲。面试重点不是背名字，而是理解属性查找和方法共享。

### 7. 实现模板字符串替换

**题目**

```js
render('hello {{ name }}', { name: 'Tom' });
```

**参考实现**

```ts
function render(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const value = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, data);

    return value == null ? '' : String(value);
  });
}
```

**追问点**

**追问 1：如何支持嵌套路径？**

把匹配到的 path 按 `.` 拆分，然后从 data 上逐层读取，比如 `user.name` 读取 `data.user.name`。当前实现已经用 `path.split('.')` 支持了基础嵌套路径。

**追问 2：如何防止原型链污染？**

读取路径时不要允许 `__proto__`、`constructor`、`prototype` 等危险 key，也不要把模板路径用于写对象。更严格可以只允许白名单字段，或使用 `Object.hasOwn` 限制只读对象自身属性。

```ts
const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
```

**追问 3：找不到值返回什么？**

要看业务约定。模板渲染常见做法是返回空字符串，避免页面出现 `undefined`。如果是配置系统或消息模板，也可以保留原占位符，方便发现配置错误。面试里说明取舍即可。

### 8. 实现 LRU Cache

**题解口径**

用 Map 保持插入顺序。get 时删除再重新 set，表示最近使用。put 超过容量时删除 Map 的第一个 key。

```ts
class LRUCache<K, V> {
  private cache = new Map<K, V>();

  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key: K, value: V) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, value);

    if (this.cache.size > this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }
}
```

## 蚂蚁 / 阿里风格

### 1. TS 如何约束复杂业务状态？

**题解口径**

用 discriminated union 表达状态机，避免非法状态组合。例如 loading 状态不应该同时有 data 和 error。通过类型让非法状态在编译期暴露。

```ts
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### 2. 如何设计类型安全的策略表？

**题解口径**

用字面量联合类型约束 key，用 `Record` 保证每种业务类型都有策略实现。

```ts
type OrderStatus = 'pending' | 'paid' | 'closed';

const statusText: Record<OrderStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  closed: '已关闭',
};
```

### 3. interface 和 type 怎么在团队里取舍？

**题解口径**

对象模型和可扩展公共接口优先 interface；联合、条件、映射、工具类型优先 type。更重要的是团队一致性和可读性。

### 4. any、unknown、never 区别？

**题解口径**

`any` 放弃类型检查，风险最高。`unknown` 表示未知类型，使用前必须收窄，更安全。`never` 表示不可能出现的类型，常用于穷尽检查。

### 5. 如何把 TS 和接口联动？

**题解口径**

可以从 OpenAPI、Swagger 或后端协议生成类型，前端服务层做 DTO 到 ViewModel 的转换。生成类型解决接口边界，业务类型解决领域语义，不要直接让接口结构污染 UI。

### 6. 9 年前端 JS/TS 基础高分表达

> 我准备 JS/TS 不只是为了手写题，而是为了提升大型项目的稳定性。比如异步并发控制能对应批量请求和上传，LRU 能对应缓存治理，TS 联合类型能约束复杂状态流转，泛型请求层能减少接口误用。
