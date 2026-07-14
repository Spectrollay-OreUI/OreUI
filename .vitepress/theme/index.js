import DefaultTheme from 'vitepress/dist/client/theme-default/index.js'
import './custom.css'

export default {
    ...DefaultTheme, // 使用扩展运算符继承所有默认配置
    enhanceApp({ app, router, siteData }) {
        // 一定要保留该函数
    }
}