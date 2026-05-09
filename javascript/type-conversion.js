/**
 * JavaScript 隐式类型转换示例
 */

const obj2 = {};

console.log(obj2.valueOf()); // {}
console.log(obj2.toString()); // [object Object]
console.log(obj2 + 3); // [object Object]3

const Obj = {
  toString() {
    return '200';
  },
  valueOf() {
    return 100;
  },
};

console.log(Obj + 3); // 103

module.exports = {
  obj2,
  Obj,
};
