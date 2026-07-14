import {defineConfig} from 'vitepress'
import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// --- 配置常量 ---
const CHANGELOG_PATH = path.resolve(__dirname, '../docs/changelog/index.md')
const RE_LONG_VERSION = /^(\d+\.\d+\.\d+\.\d{8}\.\d+)(?:\s*\(?(\w+)\)?)?$/i
const RE_SHORT_VERSION = /^(\d+\.\d+(?:\.\d+)?)$/
const RE_SIDEBAR_EXTRACT = /^(\d+\.\d+)\.(\d+)\.(\d{8}\.\d+)/

const destDir = path.resolve(process.cwd(), 'docs/changelog/public');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, {recursive: true});
fs.copyFileSync(
    path.resolve(process.cwd(), 'src/assets/images/logo.png'),
    path.join(destDir, 'logo.png')
);

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
        },
        plugins: [
            {
                name: 'site-logo',
                configureServer(server) {
                    server.middlewares.use((req, res, next) => {
                        if (req.url === '/logo.png' || req.url === '/docs/changelog/logo.png') {
                            const iconPath = path.resolve(process.cwd(), 'src/assets/images/logo.png');
                            if (fs.existsSync(iconPath)) {
                                res.writeHead(200, {'Content-Type': 'image/png'});
                                res.end(fs.readFileSync(iconPath));
                                return;
                            }
                        }
                        next();
                    });
                }
            }
        ]
    },
    head: [
        ['link', {rel: 'icon', href: '/docs/changelog/logo.png'}]
    ],
    themeConfig: {
        outline: false,
        siteTitle: 'OreUI',
        logoLink: '/',
        logo: '/logo.png',
        socialLinks: [
            {icon: 'github', link: 'https://github.com/Spectrollay-OreUI/OreUI'}
        ],
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
            md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
                const token = tokens[idx];
                const textToken = tokens[idx + 1];
                const raw = textToken.content.trim();

                // --- 处理版本号 ---
                if (token.tag === 'h2') {
                    const longMatch = raw.match(RE_LONG_VERSION);
                    const shortMatch = raw.match(RE_SHORT_VERSION);

                    if (longMatch) {
                        const [_, fullV, tag] = longMatch;
                        const label = tag || 'Release';
                        token.attrSet('id', fullV);
                        textToken.content = renderBadgeHeader(label, fullV);
                        textToken.type = 'html_inline';
                    } else if (shortMatch) {
                        const v = shortMatch[1];
                        token.attrSet('id', v);
                        textToken.content = renderBadgeHeader('Legacy', v, 'legacy');
                        textToken.type = 'html_inline';
                    }
                }

                // --- 处理分类标题 ---
                if (token.tag === 'h3') {
                    textToken.content = renderSimpleTypeHeader(raw);
                    textToken.type = 'html_inline';
                }

                return self.renderToken(tokens, idx, options);
            };
        }
    }
})

// 辅助渲染函数
function renderBadgeHeader(label, version, extraClass = '') {
    return `
        <div class="v-header ${extraClass}">
            <span class="v-badge ${label.toLowerCase()}">${label}</span>
            <span class="v-full-version">v${version}</span>
        </div>`;
}

function renderSimpleTypeHeader(text) {
    return `
        <div class="v-type-header">
            <span class="v-type-text">${text}</span>
        </div>`;
}

function getChangelogSidebar() {
    if (!fs.existsSync(CHANGELOG_PATH)) return [];

    try {
        const content = fs.readFileSync(CHANGELOG_PATH, 'utf-8');
        const majorGroups = {};
        const legacy = [];

        content.split('\n').forEach(line => {
            if (!line.startsWith('## ')) return;

            const raw = line.replace('## ', '').trim();
            const longMatch = raw.match(RE_SIDEBAR_EXTRACT);

            if (longMatch) {
                const [_, majorMinor, patch] = longMatch;
                const baseV = `${majorMinor}.${patch}`;
                const fullV = raw.split(' ')[0];
                const isDev = raw.toLowerCase().includes('dev');
                const isInternal = raw.toLowerCase().includes('internal');

                if (!majorGroups[majorMinor]) majorGroups[majorMinor] = {};
                if (!majorGroups[majorMinor][baseV]) majorGroups[majorMinor][baseV] = [];

                let icon = isDev ? '🛠️' : isInternal ? '🔒' : '✅';

                majorGroups[majorMinor][baseV].push({
                    text: `${icon} v${fullV}`,
                    link: `#${fullV}`
                });
            } else {
                legacy.push({text: `📜 v${raw}`, link: `#${raw}`});
            }
        });

        const sortedMajors = Object.keys(majorGroups).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));

        const sidebar = sortedMajors.map((major, mIdx) => {
            const children = majorGroups[major];
            const sortedBases = Object.keys(children).sort((a, b) => b.localeCompare(a, undefined, {numeric: true}));

            return {
                text: major === '0.0' ? 'Demo' : `Version ${major}`,
                collapsed: mIdx !== 0,
                items: sortedBases.map((base, bIdx) => ({
                    text: `v${base}`,
                    collapsed: !(mIdx === 0 && bIdx === 0),
                    items: children[base]
                }))
            };
        });

        if (legacy.length) sidebar.push({text: 'Legacy Versions', collapsed: true, items: legacy});
        return sidebar;
    } catch (e) {
        return [];
    }
}