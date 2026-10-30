---
title: 宏与嵌套内容
---
<script setup>
const example = '<#macro card title color="#146653">\n  <section style="border:1px solid ${color};padding:16px;border-radius:8px;margin:10px 0">\n    <h3 style="color:${color};margin:0 0 8px">${title?html}</h3>\n    <#nested>\n  </section>\n</#macro>\n<@card title="校园动态">\n  <p>一段可以复用的模板，也可以容纳不同的内容。</p>\n</@card>\n<@card title="通知公告" color="#a38650">\n  <p>${notice?html}</p>\n</@card>'
const data = { notice: '这里是本周的校园活动安排。' }
</script>

# 宏与嵌套内容

宏是可以复用的模板片段。定义使用 `#macro`，调用使用 `@`。

## 定义与调用

```ftl
<#macro greet person color="black">
  <span style="color:${color}">Hello ${person?html}!</span>
</#macro>

<@greet person="Fred"/>
<@greet color="green" person="Alice"/>
```

参数顺序不限，未提供的参数使用默认值。缺失必填参数、传入未知参数会报错。宏参数具有局部作用域。

## nested

```ftl
<#macro border>
  <div class="border"><#nested></div>
</#macro>

<@border>
  这里的 HTML 和 FTL 会放入宏的 nested 位置。
</@border>
```

嵌套内容使用调用位置的变量作用域。宏中可以多次使用 `nested`。

## 传递循环变量

```ftl
<#macro repeat count>
  <#list 1..count as x>
    <#nested x, x/2, x==count>
  </#list>
</#macro>

<@repeat count=4; c, halfc, last>
  ${c}. ${halfc}<#if last> Last!</#if>
</@repeat>
```

分号后声明接收变量。少接收的值忽略，多声明但没有传入的变量不会创建。

## 试一试

<SyntaxDemo :template="example" :data="data" />
