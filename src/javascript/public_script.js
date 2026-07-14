/*
 * Copyright © 2020. Spectrollay
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * OreUI公共代码模块
 * 核心工具库:环境检测/日志管理/音效播放/导航控制
 */

import {Current_Page_Path, Current_URL, Host_Path, isDevEnv, logManager, Page_Level, Relative_Offset, Root_Path} from "@/javascript/public_define.js";
import LazyLoad from '@/libs/lazyLoad.js'
import {getMainScrollContainer} from '@components/layout/scroll-view/index.js';
import {initializeScrollContainers} from "@components/layout/scroll-view/index.js";
import {fixGlobalElementBehavior, updateFocusableElements} from "@components/design/accessibility/index.js";
import {changeSidebarState} from "@components/containers/sidebar/index.js";
import {showPop} from "@components/messages/pop/index.js";

/**
 * --- 音频管理器配置 ---
 */
const cacheName = 'oreui-audio-cache';

// 音效文件路径映射
export const soundPaths = {
    click: `${Root_Path}/sounds/click.ogg`,
    button: `${Root_Path}/sounds/button.ogg`,
    pop: `${Root_Path}/sounds/pop.ogg`,
    hide: `${Root_Path}/sounds/hide.ogg`,
    open: `${Root_Path}/sounds/drawer_open.ogg`,
    close: `${Root_Path}/sounds/drawer_close.ogg`,
    toast: `${Root_Path}/sounds/toast.ogg`
};

// 全局状态变量
let globalVolume = 1.0; // 默认音量 100%
let isMuted = false;    // 默认不静音

// 初始化 Web Audio API 上下文
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const soundBuffers = {};

// 创建音量控制节点并连接到主输出设备
const gainNode = audioContext.createGain();
gainNode.gain.value = globalVolume;
gainNode.connect(audioContext.destination);

// 页面加载时并行预下载并解码音频, 防止首次点击时因为临时解码产生延迟或杂音
Object.entries(soundPaths).forEach(([type, path]) => {
    fetch(path)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP 错误 ${response.status}`);
            return response.arrayBuffer();
        })
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            soundBuffers[type] = audioBuffer; // 将解码后的音频数据暂存到内存中
            logManager.log(`Audio [PRELOAD] 音效缓存成功: ${type}`, 'info');
        })
        .catch(err => {
            logManager.log(`Audio [PRELOAD_FAIL] 音效预载失败: ${type} 原因: ${err.message}`, 'warn');
        });
});

/**
 * 调整全局音量大小
 * @param {number} value - 音量值 (0 到 100 之间)
 */
export function setVolume(value) {
    value = Number(value);
    if (!isNaN(value)) {
        globalVolume = Math.max(0, Math.min(100, value)); // 限制在 0 到 100 之间
        // 如果当前是静音状态, 保持 gainNode 为 0, 否则立即更新音量
        if (!isMuted) {
            gainNode.gain.value = globalVolume / 100;
        }
        logManager.log(`Audio [VOLUME_CHANGE] 全局音量更新: ${globalVolume}`, 'info');
    }
}

/**
 * 设置是否静音
 * @param {boolean} mute - 是否开启静音
 */
export function setMute(mute) {
    isMuted = !!mute;
    // 如果开启静音则强制把输出音量归零, 否则恢复到之前的全局音量
    gainNode.gain.value = isMuted ? 0 : globalVolume;
    logManager.log(`Audio [MUTE_CHANGE] 静音状态更新: ${isMuted.toString()}`, 'info');
}

// 获取缓存的标准 Audio 标签 (当高级音频接口失效或未加载完时的保底方案)
async function getCachedAudio(filePath) {
    if ('caches' in window) {
        try {
            const cache = await caches.open(cacheName);
            const response = await cache.match(filePath);
            if (response) {
                const blob = await response.blob();
                return new Audio(URL.createObjectURL(blob));
            }
        } catch (error) {
            logManager.log(`Audio [CACHE_ERROR] 读取缓存失败: ${error.message}`, 'error');
        }
    }
    return new Audio(filePath);
}

/**
 * 播放音效的主入口函数
 * @param {string} type - 音效类型名称
 */
export async function playSound(type) {
    const path = soundPaths[type];
    if (!path) return logManager.log(`Audio [PLAY_ERROR] 未知的音效类型: ${type}`, 'error');

    // 应对浏览器的安全策略, 用户首次交互时如果音频上下文被挂起则手动唤醒
    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume().catch(() => {});
    }

    // 优先使用内存中已经解码好的音频数据播放
    const buffer = soundBuffers[type];
    if (buffer) {
        try {
            const source = audioContext.createBufferSource();
            source.buffer = buffer;

            // 将音频源连接到我们创建的音量控制器上
            source.connect(gainNode);
            source.start(0);

            logManager.log(`Audio [PLAY_SUCCESS] 内存级音频播放成功: ${type}`, 'info');
            return;
        } catch (e) {
            logManager.log(`Audio [PLAY_EXCEPTION] 内存播放异常, 正在启用标签保底: ${type}`, 'warn');
        }
    }

    // 降级方案: 如果网络还没下载完或者接口报错, 则使用普通的 Audio 标签播放
    try {
        const audio = await getCachedAudio(path);

        // 同步当前的音量和静音设置到普通的 Audio 标签
        audio.volume = isMuted ? 0 : (globalVolume / 100);

        // 利用 Promise 控制播放节奏, 兼顾防止网页跳转时音效被吞和防止页面卡死
        await new Promise((resolve) => {
            let resolved = false;

            const done = () => {
                if (!resolved) {
                    resolved = true;
                    resolve(); // 释放等待, 允许页面正常处理后续的点击或跳转事件
                }
            };

            // 只要音频真正开始响了就立刻放行, 不需要等整段音效播完
            audio.addEventListener('playing', done, { once: true });

            // 80ms 超时防卡死机制, 防止部分低端设备音频挂起导致网页点不动
            setTimeout(done, 80);

            audio.play().catch((err) => {
                logManager.log(`Audio [TAG_PLAY_FAIL] 标签播放失败: ${type}`, 'warn');
                done();
            });
        });

        logManager.log(`Audio [PLAY_SUCCESS] 标准级音频播放成功: ${type}`, 'info');
    } catch (error) {
        logManager.log(`Audio [FATAL_FAIL] 音效完全播放失败: ${type}`, 'error');
    }
}

/**
 * 根据点击的 HTML 元素自动匹配并播放对应的音效
 * @param {HTMLElement} element - 被点击的元素
 */
export async function playSoundType(element) {
    if (!element) return;

    const classList = element.classList;
    const tagName = element.tagName.toLowerCase();

    // 侧边栏按钮的点击音效判定
    if (classList.contains('sidebar_btn')) {
        const sidebar = document.getElementById('sidebar');
        const isOpen = sidebar && sidebar.getAttribute('data-state') === 'open';
        await playSound(isOpen ? 'close' : 'open').catch(() => {});
        return;
    }

    // 常规点击音效的判定规则
    const isClickSound =
        ['close_btn', 'contact_link_block'].some(cls => classList.contains(cls)) || (tagName === 'oreui-header-item' && (!classList.contains('header_item_blank') || classList.contains('full_screen_icon'))) || tagName === 'oreui-show-block' || (tagName === 'a' && !classList.contains('sidebar_item'));

    // 执行音效播放
    if (isClickSound) {
        await playSound('click').catch(() => {});
    }
}

/**
 * --- 导航与跳转判定 ---
 */
let isNavigating = false;

export async function ifNavigating(way, url) {
    if (isNavigating) return; // 防止重复点击
    isNavigating = true; // 设置跳转状态

    const reset = () => {
        isNavigating = false;
    };
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    try {
        switch (way) {
            case 'direct':
                window.location.href = url;
                break;

            case 'jump':
                await sleep(50);
                window.location.href = url;
                break;

            case 'open':
                await sleep(50);
                window.open(url);
                reset();
                break;

            case 'delayed_open':
                await sleep(1200);
                window.open(url);
                reset();
                break;

            default:
                reset();
        }
    } catch (e) {
        logManager.log("跳转失败: " + e, 'error');
        reset();
    }
}

/**
 * --- 交互辅助函数 ---
 */

// 返回上一界面
export async function goBack() {
    logManager.log("点击返回");
    await playSound('click').catch(() => {
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    if (window.history.length <= 1) {
        logManager.log("关闭窗口");
        window.close();
    } else {
        logManager.log("返回上一级页面");
        window.history.back();
    }
}

// 前往主页
export async function goHome() {
    await ifNavigating('jump', Host_Path);
}

// 滚动到网页顶部
export function scrollToTop() {
    const container = getMainScrollContainer();
    container.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    logManager.log("成功执行回到顶部操作");
}

// 跳转到网页顶部
export function jumpToTop() {
    const container = getMainScrollContainer();
    container.scrollTo({top: 0, behavior: 'instant'});
}

// 打开网页
export async function openLink(url) {
    await ifNavigating('open', url);
}

// 打开应用
export function launchApplication(deeplink) {
    window.location.assign(deeplink);
}

// 复制文本
export function copyText(text, type) {
    let display;
    if (type === 'text') {
        display = '文本';
    } else if (type === 'link') {
        display = '链接';
    } else if (type === 'code') {
        display = '代码';
    } else {
        display = '内容';
    }

    return navigator.clipboard.writeText(text).then(() => {
        showPop(`复制${display}成功!`, '', 'success');
        logManager.log(`复制${display}成功!`);
        return true;
    }).catch(error => {
        showPop(`复制${display}失败!`, '', 'error');
        logManager.log("复制失败: " + error, 'error');
        return false;
    });
}

/**
 * --- 页面初始化执行逻辑 ---
 */
if (typeof window !== 'undefined') {
    // 1. 夜间模式强制覆盖
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.add('no-dark-mode');
    }

    // 初始化滚动系统
    initializeScrollContainers();

    window.lazyLoadOptions = {
        selector: 'img.lazy, .lazy-bg',
        rootMargin: '300px 0px',
        autoWatch: true,
        onSetup: (el) => {
            if (el.classList.contains('update_logo')) {
                el.style.width = '100px';
            } else if (el.classList.contains('keyart')) {
                el.style.width = '140px';
            }
        }
    };

    const oreuiLazy = new LazyLoad(window.lazyLoadOptions.selector, window.lazyLoadOptions);
    window.__OREUI_LAZY__ = oreuiLazy;
    oreuiLazy.init();

    window.addEventListener('load', () => {
        setTimeout(() => {
            // 某些由脚本动态生成的遗漏元素，手动触发一次全量扫描
            oreuiLazy.update();

            // 其他 UI 行为修正
            if (typeof fixGlobalElementBehavior === 'function') {
                fixGlobalElementBehavior();
            }
        }, 10);
    });

    window.addEventListener('oreui-sidebar-sync', (e) => {
        const {isLargeScreen} = e.detail;
        const mainScrollView = document.querySelector('.main_scroll_view');
        if (!mainScrollView) return;

        const rootStyle = getComputedStyle(document.documentElement);
        const sidebarWidth = rootStyle.getPropertyValue('--sidebar-width').trim();

        mainScrollView.style.transition = 'margin-left 0.6s, width 0.6s';

        if (isLargeScreen) {
            mainScrollView.style.marginLeft = sidebarWidth;
            mainScrollView.style.width = `calc(100% - ${sidebarWidth})`;
        } else {
            mainScrollView.style.marginLeft = '0';
            mainScrollView.style.width = '100%';
        }
    });

    // 2. 基础调试信息
    logManager.log(`OreUI运行环境: ${isDevEnv ? '开发/测试' : '生产'}`);
    logManager.log("浏览器UA: " + navigator.userAgent)
    logManager.log("完整路径: " + Current_URL);
    logManager.log("来源: " + Host_Path);
    logManager.log("根路径: " + Root_Path);
    logManager.log("当前路径: " + Current_Page_Path);
    logManager.log(`当前深度: ${Page_Level}级, 偏移: ${Relative_Offset}`);

    // 3. 生产环境安全限制
    if (!isDevEnv && !Host_Path.includes('localhost')) {
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('touchstart', e => e.preventDefault());
    }

    // 4. 事件绑定
    const logo = document.querySelector('oreui-header-logo');
    if (logo) {
        logo.addEventListener('click', scrollToTop);
    }

    document.addEventListener('click', async (e) => {
        // 寻找点击链路中最近的可点击元素
        const target = e.target.closest([
            'oreui-button:not([status="disabled"])',
            'a:not(oreui-sidebar-list a):not([href^="#"]):not([href^="javascript:"])',
            '[data-event]'
        ].join(','));

        // 如果不符合以上高精筛选条件（比如点到了禁用的按钮或侧边栏里的 a），target 直接为 null，一枪秒杀
        if (!target) return;

        // 1. 自动触发音效
        if (typeof playSoundType === 'function') {
            await playSoundType(target).catch(() => {
            });
        }

        // 2. 自动处理点击事件
        const eventAttr = target.getAttribute('data-event');
        if (!eventAttr) return;

        const events = eventAttr.split(/\s*;\s*/).filter(v => v.trim() !== '');
        for (const eventType of events) {
            let name = eventType;
            let params = [];

            if (eventType.includes('(') && eventType.endsWith(')')) {
                name = eventType.split('(')[0];
                const rawParams = eventType.split('(')[1].slice(0, -1);
                if (name === 'link') {
                    const firstComma = rawParams.indexOf(',');
                    if (firstComma !== -1) {
                        params = [
                            rawParams.substring(0, firstComma).trim(),
                            rawParams.substring(firstComma + 1).trim()
                        ];
                    }
                } else {
                    params = rawParams.split(',').map(p => p.trim());
                }
            }

            switch (name) {
                case 'alert':
                    if (params.length >= 1) {
                        alert(params[0]);
                    } else {
                        logManager.log('指令缺少必要参数', 'warn');
                    }
                    break;

                case 'link':
                    if (params.length >= 2) {
                        await ifNavigating(params[0], params[1]);
                    } else {
                        logManager.log('指令缺少必要参数', 'warn');
                    }
                    break;

                case 'back':
                    await goBack();
                    break;

                case 'home':
                    await goHome();
                    break;

                case 'changeSidebarState':
                    changeSidebarState(e);
                    isNavigating = false;
                    break;

                case '#':
                    break;

                default:
                    logManager.log(`未定义的事件类型: ${name}`, 'warn');
            }
        }
    });

    // 5. 性能统计
    const startTime = performance.now();
    window.addEventListener('load', () => {
        logManager.log(`页面加载耗时: ${Math.round(performance.now() - startTime)}ms`);
    });

    // 6. 全局错误捕获
    window.addEventListener('error', (event) => {
        logManager.log(`运行时错误: ${event.message}`, 'error');
    });
}