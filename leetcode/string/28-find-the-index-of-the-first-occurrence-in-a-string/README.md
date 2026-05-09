# 28. 找出字符串中第一个匹配项的下标

## 分类

- String
- String Matching
- Two Pointers

## 题目目标

给定两个字符串 `haystack` 和 `needle`，在 `haystack` 中找出 `needle` 第一次出现的下标。

如果 `needle` 不是 `haystack` 的一部分，返回 `-1`。

示例：

```js
haystack = 'sadbutsad';
needle = 'sad';
```

`'sad'` 第一次从下标 `0` 开始出现，所以返回 `0`。

## 解题思路

这题找的是连续子串，不是子序列。

也就是说，`needle` 中的字符必须按原顺序连续出现在 `haystack` 中，中间不能夹其他字符。

朴素匹配思路：

1. 枚举 `haystack` 中每一个可能的起点 `i`。
2. 从 `i` 开始，逐个比较 `haystack[i + j]` 和 `needle[j]`。
3. 如果 `needle` 的每个字符都匹配，返回起点 `i`。
4. 如果所有起点都无法匹配，返回 `-1`。

起点最多只需要枚举到：

```js
haystack.length - needle.length
```

因为再往后剩余长度已经不够放下完整的 `needle`。

## 和子序列的区别

如果题目允许中间隔字符，比如 `f...d...i` 也算，那是子序列问题。

本题是子串匹配，必须连续。例如：

```js
haystack = 'sbsdffafdixfssw';
needle = 'fdi';
```

`'fdi'` 从下标 `7` 开始连续出现，所以返回 `7`。

## 复杂度

- 时间复杂度：`O(n * m)`，其中 `n` 是 `haystack.length`，`m` 是 `needle.length`。
- 空间复杂度：`O(1)`。

## 易错点

- 匹配的是连续子串，不是只要求顺序一致的子序列。
- 外层循环边界是 `i <= haystack.length - needle.length`。
- `needle` 为空字符串时，按题意应返回 `0`。

## 代码

见同目录下的 `28-find-the-index-of-the-first-occurrence-in-a-string.js`。
