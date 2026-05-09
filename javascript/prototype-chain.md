# 原型链

## 核心概念

原型链是 JavaScript 的属性查找机制：

当访问一个对象的属性或方法时，如果对象自身没有，JavaScript 会沿着它的原型对象继续查找；原型对象也没有，就继续向上找，直到 `null`。

这条查找路径就是原型链。

## prototype 和 [[Prototype]]

常见面试关系：

```js
function Person(name) {
  this.name = name;
}

const p = new Person('Tom');

Object.getPrototypeOf(p) === Person.prototype; // true
Object.getPrototypeOf(Person.prototype) === Object.prototype; // true
Object.getPrototypeOf(Object.prototype) === null; // true
```

对应的原型链是：

```txt
p -> Person.prototype -> Object.prototype -> null
```

注意：

- `prototype` 是函数上的属性，主要用于给实例共享方法。
- `Object.getPrototypeOf(obj)` 拿到的是对象的隐式原型。
- `__proto__` 也能访问隐式原型，但更推荐使用 `Object.getPrototypeOf`。

## new 做了什么

`new Person('Tom')` 大致做了四件事：

1. 创建一个新对象。
2. 把新对象的原型指向 `Person.prototype`。
3. 用新对象作为 `this` 执行 `Person`。
4. 如果构造函数没有返回对象，就返回这个新对象。

## 属性查找规则

```js
function Person(name) {
  this.name = name;
}

Person.prototype.sayHi = function () {
  return `Hi, I'm ${this.name}`;
};

const p = new Person('Tom');

p.sayHi(); // "Hi, I'm Tom"
```

`p` 自己没有 `sayHi`，所以会继续查找 `Person.prototype.sayHi`。

如果实例上有同名属性，会优先使用实例自己的属性：

```js
Person.prototype.age = 18;

p.age = 20;

p.age; // 20
Person.prototype.age; // 18
```

## 面试一句话

原型链是 JavaScript 实现继承和属性查找的机制。实例对象通过隐式原型连接到构造函数的 `prototype`，再继续连接到 `Object.prototype`，最终到 `null`。

## `DogFactory.prototype.__proto__` 和 `DogFactory.__proto__` 的区别

先看例子：

```js
function DogFactory(type, color) {
  this.type = type;
  this.color = color;
  this.constant_temperature = 1;
}

const dog1 = new DogFactory('Dog', 'Black');
const dog2 = new DogFactory('Dog', 'Black');
const dog3 = new DogFactory('Dog', 'Black');
```

执行 `new DogFactory()` 时，实例对象会连接到构造函数的 `prototype`：

```js
Object.getPrototypeOf(dog1) === DogFactory.prototype; // true
```

所以实例对象的查找链是：

```txt
dog1 -> DogFactory.prototype -> Object.prototype -> null
```

因此：

```js
Object.getPrototypeOf(DogFactory.prototype) === Object.prototype; // true
```

这对应的就是：

```js
DogFactory.prototype.__proto__ === Object.prototype; // true
```

它描述的是“实例继承链”：`dog1`、`dog2`、`dog3` 这些由 `new DogFactory()` 创建出来的实例，查找共享方法时会先到 `DogFactory.prototype`，再往上到 `Object.prototype`。

而 `DogFactory` 本身也是一个对象，并且它是函数对象。函数对象的原型来自 `Function.prototype`：

```js
Object.getPrototypeOf(DogFactory) === Function.prototype; // true
```

这对应的就是：

```js
DogFactory.__proto__ === Function.prototype; // true
```

它描述的是“函数对象自身的继承链”：

```txt
DogFactory -> Function.prototype -> Object.prototype -> null
```

所以二者的区别是：

- `DogFactory.prototype.__proto__`：看的是实例继承链中，`DogFactory.prototype` 的上一层是谁。
- `DogFactory.__proto__`：看的是 `DogFactory` 这个函数对象自身的上一层是谁。

一句话记忆：

`DogFactory.prototype.__proto__` 服务于 `dog1` 这类实例的属性查找；`DogFactory.__proto__` 服务于 `DogFactory` 函数对象自己的属性查找。

## 代码

见同目录下的 `prototype-chain.js`。
