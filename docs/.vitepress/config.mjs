import { defineConfig } from 'vitepress'
import sidebar from '../data/sidebar.json' with { type: 'json' }
export default defineConfig({
  lang: 'zh-CN', title: '博达组件文档', description: '博达组件参数与模板语法',
  cleanUrls: true,
  appearance: false,
  base: process.env.DOCS_BASE || '/',
  head: [['meta', { name: 'theme-color', content: '#146653' }]],
  themeConfig: {
    siteTitle: '博达组件文档',
    nav: [{ text: '组件库', link: '/' }, { text: '模板语法', link: '/syntax/' }],
    search: { provider: 'local', options: { locales: { root: { translations: { button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' }, modal: { noResultsText: '没有找到相关内容', resetButtonTitle: '清除搜索', footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' } } } } } } },
    sidebar: { '/components/': sidebar, '/syntax/': [{ text: '模板语言', items: [{ text: '语法总览', link: '/syntax/' }, { text: '输出与表达式', link: '/syntax/expressions' }, { text: '条件与循环', link: '/syntax/directives' }, { text: '内建函数', link: '/syntax/builtins' }, { text: '宏与嵌套内容', link: '/syntax/macros' }, { text: '博达函数', link: '/syntax/helpers' }] }] },
    outline: { label: '本页内容', level: [2, 3] }, docFooter: { prev: '上一页', next: '下一页' }, returnToTopLabel: '返回顶部', sidebarMenuLabel: '目录'
  },
  vite: { worker: { format: 'es' }, build: { chunkSizeWarningLimit: 1800 }, server: { fs: { allow: ['..'] } } }
})
