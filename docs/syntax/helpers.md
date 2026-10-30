---
title: 博达函数
---
<script setup>
const example = '<a href="${siteUrl}">${v_media(imageUrl, 240, 150, siteName)}</a>\n<p>${siteName?html}</p>\n<p>${v_date(date, "yyyy年MM月dd日")}</p>'
const data = { siteUrl: '#', siteName: '示例网站', date: '2026-10-30 09:30:00', imageUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150"><rect width="240" height="150" fill="#e6efe3"/><text x="25" y="85" fill="#5e8150" font-size="22">IMAGE PREVIEW</text></svg>') }
</script>

# 博达函数

| 函数 | 用途 |
| --- | --- |
| `v_link(path)` | 资源地址 |
| `v_media(url, width, height, title)` | 媒体内容 |
| `v_includeJquery()` | 引入 jQuery |
| `v_date(value, pattern)` | 日期格式化 |

## 试一试

<SyntaxDemo :template="example" :data="data" />
