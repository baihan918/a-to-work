# JavaScript 类型转换

## 为什么 `obj2 + 3` 是 `"[object Object]3"`？

例子：

```js
const obj2 = {};

obj2 + 3; // "[object Object]3"
```

`+` 运算符比较特殊：它既可以做数字相加，也可以做字符串拼接。

当 `+` 的一侧是对象时，JavaScript 会先把对象转换成原始值。普通对象默认会按下面的顺序尝试：

1. 调用 `valueOf()`。
2. 如果结果不是原始值，再调用 `toString()`。

对于普通对象 `{}` 来说：

```js
obj2.valueOf(); // {}
obj2.toString(); // "[object Object]"
```

`valueOf()` 返回的还是对象，不是原始值，所以继续调用 `toString()`。默认的 `Object.prototype.toString()` 返回字符串 `"[object Object]"`。

于是表达式变成：

```js
"[object Object]" + 3
```

只要 `+` 两边有一边是字符串，就会执行字符串拼接，所以结果是：

```js
"[object Object]3"
```

## 为什么自定义 `valueOf()` 后是 `103`？

例子：

```js
const Obj = {
  toString() {
    return '200';
  },
  valueOf() {
    return 100;
  },
};

Obj + 3; // 103
```

这次对象有自己的 `valueOf()`，并且返回的是原始值 `100`。所以对象转原始值时，转换过程在 `valueOf()` 这里就结束了，不会继续调用 `toString()`。

于是表达式变成：

```js
100 + 3
```

两边都是数字，所以执行数字相加，结果是：

```js
103
```

虽然 `Obj.toString()` 返回 `'200'`，但在这个例子里它不会参与 `Obj + 3` 的计算，因为 `valueOf()` 已经返回了可用的原始值。

## 记忆方式

对象参与 `+` 运算时，先转原始值，再决定相加还是拼接。

- 如果对象最终转成字符串，通常会触发字符串拼接。
- 如果对象最终转成数字，通常会触发数字相加。
- 对普通对象来说，默认 `valueOf()` 不好用，最终会落到 `toString()`。

