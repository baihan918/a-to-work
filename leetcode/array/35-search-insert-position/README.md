# 二分查找

## 分类

- Array
- Binary Search

## 704. 二分查找

### 题目目标

给定一个升序且元素不重复的数组 `nums` 和一个目标值 `target`：

- 找到 `target` 时，返回它的下标。
- 找不到时，返回 `-1`。

### 解题思路

使用左闭右闭区间 `[left, right]`：

```js
let left = 0;
let right = nums.length - 1;
```

因为 `left` 和 `right` 指向的位置都属于搜索范围，所以循环条件是：

```js
while (left <= right)
```

每次比较 `nums[mid]` 和 `target`：

- `nums[mid] === target`：找到目标值，返回 `mid`。
- `nums[mid] < target`：目标值只可能在右半部分，令 `left = mid + 1`。
- `nums[mid] > target`：目标值只可能在左半部分，令 `right = mid - 1`。

循环结束仍未找到，返回 `-1`。

### 为什么是 mid + 1 和 mid - 1

执行到移动指针时，已经确定 `nums[mid] !== target`，所以 `mid` 不需要再次参与搜索：

```js
left = mid + 1;
right = mid - 1;
```

如果只写成 `left = mid` 或 `right = mid`，搜索区间可能无法缩小，导致死循环。

### 复杂度

- 时间复杂度：`O(log n)`
- 空间复杂度：`O(1)`

### 代码

见同目录下的 `704-binary-search.js`。

---

## 35. 搜索插入位置

## 题目目标

给定一个升序数组 `nums` 和一个目标值 `target`：

- 如果 `target` 存在，返回它的下标。
- 如果 `target` 不存在，返回它按顺序插入数组时的位置。

题目要求时间复杂度为 `O(log n)`，因此使用二分查找。

## 解题思路

这道题本质上是在寻找：

> 数组中第一个大于等于 `target` 的位置。

使用左闭右闭区间 `[left, right]`：

```js
let left = 0;
let right = nums.length - 1;
```

每次取中间位置 `mid`：

- 如果 `nums[mid] < target`，说明 `mid` 以及它左边的位置都不可能是答案，令 `left = mid + 1`。
- 如果 `nums[mid] >= target`，说明答案可能是 `mid`，也可能在它左边，令 `right = mid - 1`。

循环结束时 `left > right`，此时 `left` 就是第一个大于等于 `target` 的位置。

## 为什么返回 left

循环过程中：

- `left` 左边的元素一定都小于 `target`。
- `right` 右边的元素一定都大于等于 `target`。

当循环结束时，`left === right + 1`，两个区域的分界点就是 `target` 应该出现或插入的位置。

例如：

```text
nums = [1, 3, 5, 6]
target = 2

循环结束：
[1] [3, 5, 6]
     ↑
    left = 1
```

因此返回 `1`。

## 复杂度

- 时间复杂度：`O(log n)`
- 空间复杂度：`O(1)`

## 易错点

- 左闭右闭区间的循环条件是 `left <= right`。
- 当 `nums[mid] >= target` 时不能直接返回，因为还要继续向左寻找第一个符合条件的位置。
- `mid` 推荐写成 `left + Math.floor((right - left) / 2)`。
- `target` 比所有元素都大时，最终 `left === nums.length`，正好表示插入到数组末尾。

## 代码

见同目录下的 `35-search-insert-position.js`。

## 两道题的区别

两道题都使用左闭右闭的二分查找，区别在于目标不同：

| 题目 | 查找目标 | 找到时 | 找不到时 |
| --- | --- | --- | --- |
| 704. 二分查找 | 等于 `target` 的元素 | 立即返回 `mid` | 返回 `-1` |
| 35. 搜索插入位置 | 第一个大于等于 `target` 的位置 | 继续向左收缩 | 返回 `left` |

704 是标准的“精确查找”，35 是在二分查找基础上寻找左边界。
