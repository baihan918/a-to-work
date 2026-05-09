/**
 * JavaScript 原型链示例
 */

function Person(name) {
  this.name = name;
}

Person.prototype.sayHi = function () {
  return `Hi, I'm ${this.name}`;
};

Person.prototype.age = 18;

const person = new Person('Tom');

console.log(person.sayHi()); // Hi, I'm Tom

// 实例的隐式原型指向构造函数的 prototype。
console.log(Object.getPrototypeOf(person) === Person.prototype); // true

// 构造函数的 prototype 继续向上连接到 Object.prototype。
console.log(Object.getPrototypeOf(Person.prototype) === Object.prototype); // true

// Object.prototype 是常规对象原型链的终点。
console.log(Object.getPrototypeOf(Object.prototype) === null); // true

// 属性查找：实例自身没有 age 时，会从 Person.prototype 上找到。
console.log(person.age); // 18

// 实例同名属性优先级更高，不会修改原型上的属性。
person.age = 20;

console.log(person.age); // 20
console.log(Person.prototype.age); // 18

function DogFactory(type, color) {
  this.type = type;
  this.color = color;
  this.constant_temperature = 1;
}

const dog1 = new DogFactory('Dog', 'Black');
const dog2 = new DogFactory('Dog', 'Black');
const dog3 = new DogFactory('Dog', 'Black');

DogFactory.prototype.say = function () {
  return `${this.color} ${this.type}`;
};

console.log(dog1.say()); // Black Dog
console.log(dog2.say()); // Black Dog
console.log(dog3.say()); // Black Dog

// 实例继承链：实例 -> DogFactory.prototype -> Object.prototype -> null。
console.log(Object.getPrototypeOf(dog1) === DogFactory.prototype); // true
console.log(Object.getPrototypeOf(DogFactory.prototype) === Object.prototype); // true

// 函数对象自身的继承链：DogFactory -> Function.prototype -> Object.prototype -> null。
console.log(Object.getPrototypeOf(DogFactory) === Function.prototype); // true
console.log(Object.getPrototypeOf(Function.prototype) === Object.prototype); // true

module.exports = Person;
