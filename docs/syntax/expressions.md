---
title: 输出与表达式
---
<script setup>
const example = '<h2>${(article.title)!"暂无标题"}</h2>\n<p>阅读 ${count + 1} 次</p>\n<p>${(price * 0.8)?string("0.00")} 元</p>\n<#if article.subtitle??>\n<p>${article.subtitle?html}</p>\n</#if>'
const data = { article: { title: '探索与发现', subtitle: '让每一份热爱都有生长的土壤' }, count: 128, price: 39.9 }
</script>

# 输出与表达式

## 变量与属性

```ftl
${showTitle}
${news.showTitle}
${news["showTitle"]}
${list_news[0].showTitle}
```

输出原文不会自动转义。普通文字需要 HTML 转义时用 `${showTitle?html}`；正文 HTML 可以直接输出。

## 字面量

```ftl
${"Hello"}
${'It\'s a title'}
${r"C:\foo\bar"}
${"Hello ${user}!"}
${12.5 + 2}
```

字符串支持单引号、双引号及常用转义；raw 字符串在引号前加 `r`，不处理转义和插值。

布尔值使用 `true` / `false`。推荐通过 `${isNew?string("新", "旧")}` 或 `${isNew?c}` 输出。

## 运算符

| 类别 | 运算符 |
| --- | --- |
| 算术 | `+ - * / %` |
| 相等 | `=`、`==`、`!=` |
| 比较 | `< <= > >=` 或 `lt lte gt gte` |
| 逻辑 | `&&` / `and`、`\|\|` / `or`、`!` / `not` |
| 范围 | `1..5`、`5..1`，包含两端 |

数值和字符串相加会拼接；其他算术要求数字。相等比较要求类型一致，`1 = "1"` 会报错。逻辑运算和 `if` 条件要求布尔值。

在指令内使用大于号时加括号，避免与标签结束符冲突：

```ftl
<#if (count > 10)>很多条目</#if>
<#if count gt 10>很多条目</#if>
```

## 缺失值

```ftl
${(news.showTitle)!"暂无标题"}
${optionalText!}
<#if news.showTitle??>标题存在</#if>
```

`!` 指定默认值，`??` 检查存在性。涉及运算时请明确加括号，如 `${(price!0) * 2}`。

## 列表与散列

```ftl
<#assign colors=["green", "blue"]>
<#assign item={"name":"校园", "count":3}>
${colors[0]} ${item.name}
```

## 试一试

<SyntaxDemo :template="example" :data="data" />
