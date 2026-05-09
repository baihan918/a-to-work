# 工程化：大厂追问题库

## 字节风格

### 1. ES6 代码到浏览器 ES5，构建工具做了什么？

**题解口径**

主要包括语法转换、模块解析、依赖图构建、polyfill 注入或按需引入、资源处理、代码压缩、拆包、hash 命名、sourcemap 生成。Babel/SWC 负责语法转换，Webpack/Vite/Rollup 负责编译打包和产物组织。

**继续追问**

**追问 1：Babel plugin 和 preset 区别？**

plugin 是一个具体转换能力，比如转换可选链、class properties。preset 是一组 plugin 的集合，用来按场景批量启用转换能力，例如 `@babel/preset-env`、`@babel/preset-react`、`@babel/preset-typescript`。可以理解为 plugin 是单个能力，preset 是能力包。

**追问 2：polyfill 和 syntax transform 区别？**

syntax transform 解决“语法浏览器不认识”的问题，例如把箭头函数、class 转成旧语法。polyfill 解决“运行时 API 不存在”的问题，例如 `Promise`、`Array.prototype.includes`、`WeakMap`。语法转换不能凭空提供运行时 API，所以两者要分开看。

**追问 3：`@babel/preset-env` 怎么按目标浏览器处理？**

它会根据 `browserslist` 目标和兼容性数据决定需要启用哪些语法转换。如果配置了 `useBuiltIns` 和 core-js，还可以按需注入 polyfill。现代浏览器目标越新，需要转换和 polyfill 的内容越少，产物也更小。

### 2. tree shaking 的原理是什么？

**题解口径**

依赖 ESM 静态结构，构建工具能在编译期分析哪些 export 没被使用，再通过压缩阶段删除死代码。CommonJS、动态访问、副作用模块、错误的 `sideEffects` 声明都可能导致失效。

### 3. Vite 为什么开发环境快？

**题解口径**

Vite 开发环境利用浏览器原生 ESM，启动时不需要把整个应用完整打包，只按需转换请求的模块。依赖预构建减少 CommonJS 和多模块开销。生产构建仍然要打包，通常基于 Rollup。

### 4. Webpack loader 和 plugin 区别？

**题解口径**

loader 处理单个或一类文件的转换，例如 TS、CSS、图片。plugin 通过钩子介入整个构建生命周期，例如生成 HTML、提取 CSS、定义环境变量、优化 chunk。

### 5. source map 有哪些类型？线上怎么选？

**题解口径**

开发环境可以用速度快、信息完整的 sourcemap。生产环境通常生成独立 sourcemap 上传监控平台，不公开暴露。选择要平衡构建速度、定位精度和源码泄露风险。

### 6. 如何做首屏拆包？

**题解口径**

先分析首屏关键路径。路由级 lazy、重组件延迟加载、第三方库拆分、减少 polyfill、抽离稳定 vendor、预加载关键 chunk。拆包后要看网络和执行成本，不是 chunk 越多越好。

### 7. 手写一个并发请求调度器

**题解思路**

维护一个队列和当前运行数。每次启动任务时运行数加一，完成后减一，并继续调度下一个。要保证结果顺序、错误处理和最终 Promise resolve。

```ts
async function runWithLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  let running = 0;

  return new Promise((resolve, reject) => {
    const next = () => {
      if (index === tasks.length && running === 0) {
        resolve(results);
        return;
      }

      while (running < limit && index < tasks.length) {
        const current = index++;
        running++;
        tasks[current]()
          .then(result => {
            results[current] = result;
          })
          .catch(reject)
          .finally(() => {
            running--;
            next();
          });
      }
    };

    next();
  });
}
```

## 蚂蚁 / 阿里风格

### 1. 组件库如何保证质量？

**题解口径**

API 评审、Storybook 或文档站、单测、视觉回归、可访问性检查、变更日志、semver、灰度使用、迁移指南。核心组件要有严格测试和真实场景验证。

### 2. 如何设计前端发布回滚？

**题解口径**

产物带版本号，静态资源不可变，HTML 入口可切换版本。发布系统保留历史版本，监控异常自动告警，必要时回滚入口指向旧版本。sourcemap、接口兼容和 CDN 刷新要同步考虑。

### 3. 如何推动团队统一规范？

**题解口径**

规范要工具化，不靠口头约定。通过 ESLint、Prettier、TypeScript、commit hook、CI 门禁、模板、脚手架和 review checklist 落地。先解决高频痛点，再逐步收敛。

### 4. monorepo 怎么做依赖边界治理？

**题解口径**

通过 workspace 管理包，明确包职责，使用构建缓存和增量构建，限制跨包私有路径引用。发版用 changesets 或类似工具，公共包保持 semver 和 changelog。

### 5. 你做过的工程化收益怎么量化？

**答法模板**

> 我把收益拆成交付效率、质量和排障效率。例如新页面开发从 X 天降到 Y 天；线上同类错误下降 Z%；平均定位时间从 X 分钟降到 Y 分钟；重复代码减少了多少；新人接入时间缩短多少。
