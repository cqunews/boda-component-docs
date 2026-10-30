import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import CatalogPage from './components/CatalogPage.vue'
import ComponentPage from './components/ComponentPage.vue'
import SyntaxDemo from './components/SyntaxDemo.vue'
import './style.css'
export default {
  extends: DefaultTheme, Layout,
  enhanceApp({ app }) {
    app.component('CatalogPage', CatalogPage)
    app.component('ComponentPage', ComponentPage)
    app.component('SyntaxDemo', SyntaxDemo)
  }
}
