# JavaScript 字符串方法

## `substr` 和 `substring` 的区别

`substr` 和 `substring` 都可以截取字符串，但参数含义不同。

## 参数含义

`substr` 的第二个参数表示截取长度：

```js
str.substr(start, length);
```

`substring` 的第二个参数表示结束下标，不包含 `end`：

```js
str.substring(start, end);
```

例子：

```js
const str = 'abcdef';

str.substr(1, 3); // "bcd"
str.substring(1, 3); // "bc"
```

## 负数处理

`substr` 的 `start` 可以是负数，表示从字符串末尾开始数：

```js
const str = 'abcdef';

str.substr(-2, 2); // "ef"
```

`substring` 遇到负数会当成 `0`：

```js
const str = 'abcdef';

str.substring(-2, 2); // "ab"
```

## 参数顺序

`substring` 如果 `start > end`，会自动交换两个参数：

```js
const str = 'abcdef';

str.substring(4, 1); // "bcd"
```

相当于：

```js
str.substring(1, 4); // "bcd"
```

`substr` 的第二个参数是长度，不是结束下标，所以不会做这种交换：

```js
const str = 'abcdef';

str.substr(4, 1); // "e"
```

## 建议

实际开发中更推荐使用 `slice(start, end)`。

`substr()` 是历史遗留方法，不建议在新代码里继续使用。

## 记忆方式

`substr(start, length)` 看长度。

`substring(start, end)` 看下标区间。

