/**
 * LeetCode 704. 二分查找
 *
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
function search(nums, target) {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);

    if (nums[mid] === target) {
      return mid;
    }

    if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}

/**
 * 写法二：先寻找第一个大于等于 target 的位置，再判断是否命中。
 *
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
function searchByLeftBoundary(nums, target) {
  let left = 0;
  let right = nums.length - 1;

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);

    if (nums[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return nums[left] === target ? left : -1;
}

console.log(search([-1, 0, 3, 5, 9, 12], 9)); // 4
console.log(search([-1, 0, 3, 5, 9, 12], 2)); // -1

console.log(searchByLeftBoundary([-1, 0, 3, 5, 9, 12], 9)); // 4
console.log(searchByLeftBoundary([-1, 0, 3, 5, 9, 12], 2)); // -1

module.exports = {
  search,
  searchByLeftBoundary,
};
