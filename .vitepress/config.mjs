import {defineConfig} from 'vitepress'
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHANGELOG_PATH = path.resolve(__dirname, '../docs/changelog/index.md')
const RE_LONG_VERSION = /^(\d+\.\d+\.\d+\.\d{8}\.\d+)(?:\s*\(?([\u4e00-\u9fa5\w]+)\)?)?$/i
const RE_SHORT_VERSION = /^(\d+\.\d+(?:\.\d+)?)$/
const RE_SIDEBAR_EXTRACT = /^(\d+\.\d+)\.(\d+)\.(\d{8}\.\d+)/

syncStaticAssets()

export default defineConfig({
    title: "OreUI",
    srcDir: 'docs/changelog',
    base: '/docs/changelog/',
    outDir: path.resolve(__dirname, '../dist/docs/changelog'),

    vite: {
        server: {
            fs: {
                allow: [path.resolve(__dirname, '..')]
            }
        },
        optimizeDeps: {
            noDiscovery: true,
            include: []
        }
    },

    head: [['link', {rel: 'icon', href: '/docs/changelog/logo.png'}]],

    themeConfig: {
        outline: false,
        siteTitle: 'OreUI',
        logoLink: '/',
        logo: '/logo.png',
        socialLinks: [{icon: 'github', link: 'https://github.com/Spectrollay-OreUI/OreUI'}],
        sidebar: getChangelogSidebar(),
        docFooter: {prev: false, next: false},
        footer: {
            message: 'MIT Licensed',
            copyright: '© 2020 Spectrollay'
        },
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        appearanceText: '外观模式',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '回到顶部',
    },

    markdown: {
        config: (md) => {
            let isFirstH2 = true

            const defaultH2Render = md.renderer.rules.heading_open || function (tokens, idx, options, env, self) {
                return self.renderToken(tokens, idx, options)
            }

            md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
                const token = tokens[idx]
                const textToken = tokens[idx + 1]
                const raw = textToken ? textToken.content.trim() : ''

                let prefixHtml = ''

                if (token.tag === 'h2') {
                    token.attrs = null

                    const longMatch = raw.match(RE_LONG_VERSION)
                    const shortMatch = raw.match(RE_SHORT_VERSION)
                    let versionId = ''

                    if (longMatch) {
                        const [_, fullV, tag] = longMatch
                        versionId = fullV
                        const label = tag || '正式版本'
                        textToken.content = renderBadgeHeader(label, fullV)
                        textToken.type = 'html_inline'
                    } else if (shortMatch) {
                        const v = shortMatch[1]
                        versionId = v
                        textToken.content = renderBadgeHeader('传统版本', v, 'legacy')
                        textToken.type = 'html_inline'
                    }

                    prefixHtml = isFirstH2
                        ? `<div class="changelog-item" id="${versionId}">`
                        : `</div><div class="changelog-item" id="${versionId}">`

                    isFirstH2 = false
                }

                if (token.tag === 'h3') {
                    textToken.content = renderSimpleTypeHeader(raw)
                    textToken.type = 'html_inline'
                }

                return prefixHtml + defaultH2Render(tokens, idx, options, env, self)
            }

            const defaultRender = md.render.bind(md)
            md.render = (src, env) => {
                isFirstH2 = true
                let html = defaultRender(src, env)
                if (!isFirstH2) {
                    html += '</div>'
                }
                return html
            }
        }
    }
})

function renderBadgeHeader(label, version, extraClass = '') {
    const badgeClassMap = {
        '内部版本': 'internal',
        '开发版本': 'dev',
        '正式版本': 'release',
        '传统版本': 'legacy'
    }
    const badgeType = badgeClassMap[label] || label.toLowerCase()
    const containerClass = extraClass ? `v-header ${extraClass}` : 'v-header'

    return `<div class="${containerClass}"><span class="v-badge ${badgeType}">${label}</span><span class="v-full-version">v${version}</span></div>`
}

function renderSimpleTypeHeader(text) {
    return `<div class="v-type-header"><span class="v-type-text">${text}</span></div>`
}

function getChangelogSidebar() {
    if (!fs.existsSync(CHANGELOG_PATH)) return []

    try {
        const content = fs.readFileSync(CHANGELOG_PATH, 'utf-8')
        const majorGroups = {}
        const legacy = []

        const lines = content.split(/\r?\n/)
        for (const line of lines) {
            if (!line.startsWith('## ')) continue

            const raw = line.replace('## ', '').trim()
            const longMatch = raw.match(RE_SIDEBAR_EXTRACT)

            if (longMatch) {
                const [_, majorMinor, patch] = longMatch
                const baseV = `${majorMinor}.${patch}`
                const fullV = raw.split(' ')[0]
                const isDev = raw.includes('开发版本')
                const isInternal = raw.includes('内部版本')

                if (!majorGroups[majorMinor]) majorGroups[majorMinor] = {}
                if (!majorGroups[majorMinor][baseV]) majorGroups[majorMinor][baseV] = []

                const dotClass = isDev ? 'dev' : isInternal ? 'internal' : 'release'
                const statusDot = `<span class="sb-status-dot ${dotClass}"></span>`

                majorGroups[majorMinor][baseV].push({
                    text: `${statusDot}<span class="sb-v-text">v${fullV}</span>`,
                    link: `#${fullV}`
                })
            } else {
                const legacyDot = `<span class="sb-status-dot legacy"></span>`
                legacy.push({
                    text: `${legacyDot}<span class="sb-v-text">v${raw}</span>`,
                    link: `#${raw}`
                })
            }
        }

        const sortedMajors = Object.keys(majorGroups).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}))

        const sidebar = sortedMajors.map((major, mIdx) => {
            const children = majorGroups[major]
            const sortedBases = Object.keys(children).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}))

            return {
                text: major === '0.0' ? '概念版本' : `版本 ${major}`,
                collapsed: mIdx !== 0,
                items: sortedBases.map((base, bIdx) => ({
                    text: `v${base}`,
                    collapsed: !(mIdx === 0 && bIdx === 0),
                    items: children[base]
                }))
            }
        })

        if (legacy.length) {
            sidebar.push({text: '传统版本', collapsed: true, items: legacy})
        }

        return sidebar
    } catch (e) {
        console.error('[OreUI Changelog] Failed to generate sidebar:', e)
        return []
    }
}

function syncStaticAssets() {
    try {
        const destDir = path.resolve(__dirname, '../docs/changelog/public')
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, {recursive: true})

        const srcLogo = path.resolve(__dirname, '../src/assets/images/logo.png')
        if (fs.existsSync(srcLogo)) {
            fs.copyFileSync(srcLogo, path.join(destDir, 'logo.png'))
        }
    } catch (err) {
        console.warn('[OreUI Config] Logo sync skipped:', err.message)
    }
}
