---
title: 内建函数
---
<script setup>
const example = '<#list names?chunk(2, "—") as row>\n  <div class="row"><#list row as name><span>${name?upper_case?html}</span></#list></div>\n</#list>\n<p>日期：${date?string("yyyy年MM月dd日 HH:mm")}</p>\n<p>价格：${price?string("0.00")}</p>'
const data = { names: ['Tom & Jerry', 'Alice', 'Bob'], date: '2026-10-30 09:30:00', price: 12.5 }
const css = '.row{display:flex;gap:12px;margin:8px 0}.row span{flex:1;padding:12px;background:#eef4eb;border-radius:4px}'
</script>

# 内建函数

使用 `?` 调用，可连续处理：`${title?trim?upper_case?html}`。

## 字符串

| 写法 | 用途 |
| --- | --- |
| `value?html` | 转义 `& < > " '` |
| `value?cap_first` | 首个非空白字符大写 |
| `value?upper_case` / `?lower_case` | 转换大小写 |
| `value?trim` | 去除两端空白 |
| `value?replace("旧", "新")` | 按字面量替换所有匹配 |
| `value?contains("关键词")` | 是否包含，返回布尔值 |
| `value?number` | 数字字符串转换为数字 |

## 序列与散列

| 写法 | 用途 |
| --- | --- |
| `list?size` | 获取数量，也支持字符串与散列 |
| `list?chunk(3)` | 每 3 项分组 |
| `list?chunk(3, "-")` | 不足 3 项时填充 |
| `list?join(", ")` | 连接为字符串 |
| `list?reverse` | 返回倒序序列 |
| `hash?keys` | 返回键列表 |

## 数字与日期

```ftl
${(-1.9)?int}
${amount?string("0.00")}
${amount?string.currency}
${amount?string.percent}
${date?string("yyyy-MM-dd HH:mm:ss")}
#{amount; m1M2}
```

`?int` 向零截断，`-1.9` 变为 `-1`。

支持常用数字模式：`number`、`currency`、`percent`、`computer`、`0.00`、`0.##`、`#,##0.00`。支持常用日期标记：`yyyy yy MMMM MMM MM M dd d HH H hh h mm m ss s EEEE EEE`，单引号用于日期格式字面文本。

`#{...; m1M2}` 表示至少 1 位、最多 2 位小数。

## 布尔值与存在性

```ftl
${enabled?string("启用", "停用")}
${enabled?c}
<#if list_news?has_content>有内容</#if>
${title?default("暂无标题")}
```

支持 `?has_content`、`?exists` 和 `?default(...)`。推荐使用 `??`、`!` 表达简单的存在性和默认值。

## setting

```ftl
<#setting locale="zh_CN">
<#setting number_format="0.00">
<#setting boolean_format="是,否">
```

设置只作用于本次渲染。

## 试一试

<SyntaxDemo :template="example" :data="data" :css="css" />
