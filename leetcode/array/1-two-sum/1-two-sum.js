/**
 * LeetCode 1. 两数之和
 *
 * 思路：
 * 用 Map 记录已经遍历过的数字和下标。
 * 对每个数字 num，查找 target - num 是否已经出现过。
 *
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  const indexByNum = new Map();

  for (let i = 0; i < nums.length; i += 1) {
    const num = nums[i];
    const need = target - num;

    if (indexByNum.has(need)) {
      return [indexByNum.get(need), i];
    }

    indexByNum.set(num, i);
  }

  return [];
}

console.log(twoSum([2, 7, 11, 15], 9)); // [0, 1]

module.exports = twoSum;
