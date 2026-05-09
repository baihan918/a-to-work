/**
 * LeetCode 454. 四数相加 II
 *
 * 思路：
 * 1. 先枚举 nums1 + nums2 的所有和，用 Map 记录出现次数。
 * 2. 再枚举 nums3 + nums4，查找相反数在 Map 中出现了几次。
 *
 * @param {number[]} nums1
 * @param {number[]} nums2
 * @param {number[]} nums3
 * @param {number[]} nums4
 * @return {number}
 */
function fourSumCount(nums1, nums2, nums3, nums4) {
  const sumCount = new Map();

  for (const a of nums1) {
    for (const b of nums2) {
      const sum = a + b;
      sumCount.set(sum, (sumCount.get(sum) || 0) + 1);
    }
  }

  let count = 0;

  for (const c of nums3) {
    for (const d of nums4) {
      const target = -(c + d);
      count += sumCount.get(target) || 0;
    }
  }

  return count;
}

console.log(fourSumCount([1, 2], [-2, -1], [-1, 2], [0, 2])); // 2

module.exports = fourSumCount;
