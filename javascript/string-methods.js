/**
 * JavaScript 字符串方法示例
 */

const str = 'abcdef';

console.log(str.substr(1, 3)); // bcd
console.log(str.substring(1, 3)); // bc

console.log(str.substr(-2, 2)); // ef
console.log(str.substring(-2, 2)); // ab

console.log(str.substring(4, 1)); // bcd
console.log(str.substr(4, 1)); // e

module.exports = {
  str,
};
