/** @type {import('vite').UserConfig} */

import fs from "fs";
import {glob} from 'glob';
import path from 'path';
import pkg from './package.json' with {type: 'json'};
import {defineConfig} from 'vite';
import {execSync} from 'child_process';

// 扫描所有 HTML 页面并建立多页面入口映射
const htmlFiles = glob.sync('**/*.html', {
    ignore: ['node_modules/**', 'dist/**', 'docs/changelog/**', 'debug/**', 'experiments_internal/**']
}).reduce((acc, file) => {
    const name = file.replace(/\.html$/, '');
    acc[name] = path.resolve(__dirname, file);
    return acc;
}, {});

export default defineConfig({
    plugins: [
        {
            name: 'vitepress-build-sync',
            apply: 'build', // 仅在构建时触发
            closeBundle() {
                console.log('Vite [BUILD] Core library build completed, starting VitePress build');

                try {
                    const cnameSource = path.resolve(__dirname, 'CNAME');
                    const cnameDest = path.resolve(__dirname, 'dist/CNAME');

                    if (fs.existsSync(cnameSource)) {
                        fs.copyFileSync(cnameSource, cnameDest);
                        console.log('Vite [BUILD] CNAME file copied to dist/ successfully.');
                    } else {
                        console.warn('Vite [BUILD_WARN] CNAME file not found in root directory.');
                    }
                } catch (err) {
                    console.error(`Vite [BUILD_ERROR] Failed to copy CNAME: ${err.message}`);
                }

                try {
                    execSync('npx vitepress build', {stdio: 'inherit'});
                } catch (e) {
                    console.error(`Vite [BUILD_ERROR] VitePress build failed: ${e.message}`);
                }
            }
        },
        {
            name: 'html-transform',
            transformIndexHtml(html) {
                // 动态替换 HTML 中的全局版本号占位符
                return html.replace(/{VERSION}/g, pkg.version);
            },
        },
        {
            name: 'dev-404-fallback',
            configureServer(server) {
                // 开发服务器中间件: 处理多页面路由本地缺失时的 404 降级拦截
                server.middlewares.use((req, res, next) => {
                    const accept = req.headers.accept || "";

                    if (!accept.includes("text/html")) {
                        return next();
                    }

                    const url = req.url.split("?")[0];

                    if (
                        url.startsWith("/@") ||
                        url.startsWith("/src/") ||
                        url.startsWith("/node_modules/")
                    ) {
                        return next();
                    }

                    let target = url;

                    if (target === "/") {
                        target = "/index.html";
                    } else if (target.endsWith("/")) {
                        target += "index.html";
                    } else if (!target.endsWith(".html")) {
                        target += ".html";
                    }

                    const file = path.resolve(
                        server.config.root,
                        target.replace(/^\//, "")
                    );

                    if (fs.existsSync(file)) {
                        return next();
                    }

                    const errorPage = path.resolve(server.config.root, "docs/status/404.html");

                    if (!fs.existsSync(errorPage)) {
                        return next();
                    }

                    res.statusCode = 404;
                    res.setHeader("Content-Type", "text/html");

                    const html = fs.readFileSync(errorPage, "utf8");

                    server.transformIndexHtml("/docs/status/404.html", html)
                        .then(result => res.end(result));
                });
            }
        }
    ],

    base: './',

    server: {
        port: 3000,
        open: true
    },

    preview: {
        port: 8080,
        open: true,
    },

    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                ...htmlFiles,
                'oreui': path.resolve(__dirname, 'src/index.js'),
            },
            output: {
                entryFileNames: (chunk) => {
                    // 确保核心库打包出固定文件名, 业务多页面打包进 assets 目录并带上 hash
                    return chunk.name === 'oreui' ? '[name].js' : 'assets/[name]-[hash].js';
                },
                assetFileNames: 'assets/[name]-[hash].[ext]',
                manualChunks: undefined // 启用代码分割机制
            }
        }
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/components'),
            '@assets': path.resolve(__dirname, './src/assets'),
        },
    }
});
