# 博达组件文档

```sh
npm install
npm run dev
```

```sh
npm test         # 校验组件模板与预览
npm run audit    # 校验组件模板与预览
npm run build    # 静态产物 docs/.vitepress/dist
npm run preview  # 预览生产构建
```

更新采集资料：`npm run import -- /absolute/path/to/boda-components`，然后运行 audit、test 和 build。

前端编辑不会改写仓库。草稿按组件保存在浏览器；“保存方案”导出 JSON，“导出代码”导出 FTL 和 CSS。组件预览禁用脚本与表单提交，支持远程图片。演示适配可补全教师图片、二维码、组图与分页；原始空模板提供单独的参考示例。部分博达业务依赖后台，预览不执行完整业务。

引擎支持输出、表达式、条件、循环、分组、常用内建函数、assign、switch、宏与 nested；不宣称兼容全部 FreeMarker。数字使用 JS 浮点数，日期使用浏览器本地时区。

开发目录：

- `src/engine/`：表达式解析、模板 AST、解释执行、Worker
- `src/preview.mjs`：隔离预览文档生成
- `docs/data/components/`：默认模板、CSS、参数与生成示例数据
- `docs/.vitepress/theme/`：页面、编辑器和样式
- `docs/syntax/`：语法参考与在线示例
- `tests/`：语义、模板语料与浏览器测试

子路径部署：`DOCS_BASE=/boda-components-docs/ npm run build`。静态服务需要将 `/components/013` 解析为 `/components/013.html`。
