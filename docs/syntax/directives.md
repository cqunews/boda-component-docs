---
title: 条件与循环
---
<script setup>
const example = '<#assign labels=["通知", "新闻", "活动"]>\n<#list labels as label>\n  <p>${label_index + 1}. ${label}<#if label_has_next> · 后面还有内容</#if></p>\n</#list>\n<#switch category>\n  <#case "news">新闻栏目<#break>\n  <#case "event">活动栏目<#break>\n  <#default>其他栏目\n</#switch>'
const data = { category: 'news' }
</script>

# 条件与循环

## if / elseif / else

```ftl
<#if news.isNew>
  <strong>最新文章</strong>
<#elseif news.isTop>
  <strong>置顶文章</strong>
<#else>
  普通文章
</#if>
```

条件使用表达式，不要在指令内部再写 `${...}`。指令必须正确嵌套，不能交叉关闭。

## list

```ftl
<#list list_news as news>
  <p>${news_index + 1}. ${news.showTitle}</p>
  <#if news_has_next><hr></#if>
</#list>
```

`news` 是当前条目，仅在循环内有效；`news_index` 从 0 开始；`news_has_next` 为布尔值。空列表不会输出循环主体。

可以嵌套循环、遍历字面量列表或范围：

```ftl
<#list 1..5 as number>${number}</#list>
<#list ["春", "夏", "秋", "冬"] as season>${season}</#list>
```

## break

```ftl
<#list list_news as news>
  <#if news_index == 3><#break></#if>
  ${news.showTitle}
</#list>
```

退出最近一层循环或 `switch`。此前已经生成的内容会保留。

## assign 与 local

```ftl
<#assign count=6>
<#assign labels=["新闻", "活动"]>
```

`assign` 在本次渲染的全局模板作用域赋值；`local` 用于当前宏的局部赋值。当前实现支持赋值式声明，不支持捕获块式赋值。

## switch

```ftl
<#switch type>
  <#case 1>第一类<#break>
  <#case 2>第二类<#break>
  <#default>其他
</#switch>
```

匹配后会继续执行后面的分支，直到遇到 `break`，因此通常每个分支都需要写 `break`。

## 试一试

<SyntaxDemo :template="example" :data="data" />
