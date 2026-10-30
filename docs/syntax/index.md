---
title: 模板语法总览
---
<script setup>
const example = '<ul class="news-list">\n<#list list_news as news>\n  <li><a href="${news.url}">${news.showTitle?html}</a>\n  <#if news.isNew><span class="new">NEW</span></#if></li>\n</#list>\n</ul>'
const data = { list_news: [{ showTitle: '校园开放日：遇见新的可能', url: '#', isNew: true }, { showTitle: '图书馆秋季阅读计划', url: '#', isNew: false }] }
const css = '.news-list{list-style:none;padding:0}.news-list li{padding:12px 0;border-bottom:1px solid #e8eee6}.news-list a{text-decoration:none;color:#2b654f}.new{font-size:9px;color:#8c7b3d;margin-left:10px}'
</script>

# 模板语法

博达组件模板由普通 HTML 和 FTL 语法组成。HTML 决定结构，CSS 决定外观，模板变量与指令决定输出哪些内容。

<SyntaxDemo :template="example" :data="data" :css="css" />

## 三种基本结构

| 结构 | 写法 | 用途 |
| --- | --- | --- |
| 输出 | `${showTitle}` | 显示变量或表达式 |
| 指令 | `<#if isNew>…</#if>` | 条件、循环、声明 |
| 注释 | `<#-- 这是注释 -->` | 不出现在输出中 |

变量来自「示例数据」中的 JSON。

## 语法参考

1. [输出与表达式](/syntax/expressions)：变量、计算、比较、默认值。
2. [条件与循环](/syntax/directives)：if、list、break、switch。
3. [内建函数](/syntax/builtins)：分组、转义、格式化。
4. [宏与嵌套内容](/syntax/macros)：复用模板片段。
5. [博达函数](/syntax/helpers)：链接、媒体和日期函数。
