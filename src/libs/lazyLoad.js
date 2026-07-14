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

/** ==========================================================================
 * @Component    : OreUI-LazyLoad
 * @Version      : 2.0.0
 * @Description  : OreUI惰性加载组件. 爬虫优化, 图片/视频/媒体/框架的专门适配, 加载失败自动/手动重试
 * ========================================================================== */

import {logManager} from "@/javascript/public_define.js";
import {updateFocusableElements} from "@components/design/accessibility/index.js";
import loadingWhite from '@assets/images/Loading_white.gif';
import loadingBlack from '@assets/images/Loading.gif';
import errorImage from '@assets/images/ErrorMessage.png';

const STATUS = {
    INIT: 'initialized',
    LOADING: 'loading',
    LOADED: 'loaded',
    ERROR: 'error'
};

/** 判断是否为搜索引擎爬虫 */
const isBot = typeof window !== "undefined" && /bot|crawl|spider/i.test(navigator.userAgent);

export default class LazyLoad {
    /**
     * @param {string} selector - 选择器
     * @param {Object} options - 配置项
     */
    constructor(selector = '[data-src], [data-bg]', options = {}) {
        this.id = Symbol('LazyLoadInstance');
        this.selector = selector;
        this.options = {
            root: null,           // IntersectionObserver 视口根
            rootMargin: '300px 0px',
            observeRoot: null,    // MutationObserver 监听范围根
            autoWatch: true,      // 是否监听动态 DOM 变化
            autoInit: false,      // 是否构造后立即初始化
            onSetup: (el) => {
            },  // 元素挂载占位图后的回调
            ...options
        };

        this.images = {white: loadingWhite, black: loadingBlack, error: errorImage};
        this.blackImageClassList = ['header_left_icon', 'header_right_icon', 'title_icon', 'link_img_black'];

        this.observer = null;
        this.mutationObserver = null;

        // 网络恢复时自动重试失败的资源
        this.handleOnline = () => this.retryAllErrors();
        window.addEventListener('online', this.handleOnline);

        if (this.options.autoInit) this.init();
    }

    /**
     * 获取或初始化元素的实例级元数据
     * @private
     */
    _getMeta(el) {
        if (!el.__lazyMetaMap) el.__lazyMetaMap = new Map();
        if (!el.__lazyMetaMap.has(this.id)) {
            el.__lazyMetaMap.set(this.id, {
                status: null,
                requestId: 0,
                lastKey: null
            });
        }
        return el.__lazyMetaMap.get(this.id);
    }

    /**
     * 原子化更新: 防止 DOM 变更触发自身的 MutationObserver 监听
     * @private
     */
    _atomicUpdate(el, fn) {
        el.__lazyInternalLock = true;
        try {
            fn();
        } finally {
            delete el.__lazyInternalLock;
        }
    }

    /**
     * 初始化观察器
     */
    init() {
        logManager.log(`LazyLoad [INIT] 实例 ID: ${this.id.toString()}`, 'info');

        if (isBot) {
            this.update(); // 爬虫环境直接尝试触发加载
            return;
        }

        // 初始化相交观察器
        if (!this.observer && 'IntersectionObserver' in window) {
            this.observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) this.load(entry.target);
                });
            }, {root: this.options.root, rootMargin: this.options.rootMargin});
        }

        this.update();
        if (this.options.autoWatch && !this.mutationObserver) this.initMutationObserver();
    }

    /**
     * 注册观察单个元素
     */
    observe(el) {
        if (!el || this._getMeta(el).status === STATUS.LOADED) return;

        this.setup(el);

        if (!el.__lazyObservedMap) el.__lazyObservedMap = new Set();

        if (this.observer && !el.__lazyObservedMap.has(this.id)) {
            this.observer.observe(el);
            el.__lazyObservedMap.add(this.id);
        } else if (!this.observer) {
            this.load(el); // 若不支持 IO 则立即加载
        }
    }

    /**
     * 停止观察单个元素并清理实例关联状态
     */
    unobserve(el) {
        if (this.observer) {
            this.observer.unobserve(el);
            el.__lazyObservedMap?.delete(this.id);
            if (el.__lazyObservedMap?.size === 0) delete el.__lazyObservedMap;
        }
        el.__lazyMetaMap?.delete(this.id);
        if (el.__lazyMetaMap?.size === 0) delete el.__lazyMetaMap;
    }

    /**
     * 扫描指定容器内的懒加载元素
     */
    update(container = document) {
        const elements = container.querySelectorAll(this.selector);
        elements.forEach(el => this.observe(el));
    }

    /**
     * 初始化 DOM 变更观察器
     */
    initMutationObserver() {
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                const el = mutation.target;

                // 内部变更锁: 跳过由 setup/load 引起的属性变化
                if (el.__lazyInternalLock) return;

                if (mutation.type === 'attributes') {
                    // 状态属性变化不触发重新观察
                    if (mutation.attributeName === 'data-ll-status') return;
                    // 仅关注资源相关的属性变更
                    if (!['data-src', 'data-srcset', 'data-bg'].includes(mutation.attributeName)) return;
                    if (this._getMeta(el).status === STATUS.LOADING) return;

                    if (el.matches?.(this.selector)) this.observe(el);
                    return;
                }

                // 处理新增节点
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (node.matches?.(this.selector)) this.observe(node);
                    const children = node.querySelectorAll?.(this.selector);
                    if (children?.length) children.forEach(c => this.observe(c));
                });
            });
        });

        const moRoot = this.options.observeRoot || this.options.root || document.body;
        this.mutationObserver.observe(moRoot, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-src', 'data-srcset', 'data-bg']
        });
    }

    /**
     * 预处理元素: 保存原始属性并挂载占位图
     */
    setup(el) {
        const meta = this._getMeta(el);
        if (meta.status) return;

        this._atomicUpdate(el, () => {
            // 记录原始属性用于 destroy 时的恢复
            if (!el.llOriginalAttrs) {
                el.llOriginalAttrs = {
                    src: el.getAttribute('src'),
                    srcset: el.getAttribute('srcset'),
                    poster: el.getAttribute('poster'),
                    style: el.getAttribute('style')
                };
            }

            meta.status = STATUS.INIT;

            // 根据 class 决定使用黑/白占位图
            const useBlack = this.blackImageClassList.some(cls => el.classList.contains(cls));
            el.dataset.placeholder = String(useBlack ? this.images.black : this.images.white);

            if (el.tagName === 'IMG' && !el.getAttribute('src')) {
                el.src = el.dataset.placeholder;
            } else if (el.tagName === 'VIDEO' && !el.getAttribute('poster')) {
                el.poster = el.dataset.placeholder;
            }

            logManager.log(`LazyLoad [SETUP] 元素就绪: ${el.tagName}`, 'info');
            this.options.onSetup(el);
        });
    }

    /**
     * 触发资源加载
     */
    load(el, isRetry = false) {
        const meta = this._getMeta(el);
        const currentKey = `${el.dataset.src || ''}|${el.dataset.srcset || ''}|${el.dataset.bg || ''}`;

        // 核心逻辑: 若资源 Data URL 变化,强制重置状态
        if (currentKey !== meta.lastKey) {
            this._atomicUpdate(el, () => {
                meta.status = STATUS.INIT;
                if (this.observer) this.observe(el);
            });
        }

        if (!isRetry && (meta.status === STATUS.LOADING || meta.status === STATUS.LOADED)) return;

        meta.requestId++;
        const currentRequestId = meta.requestId;

        this._atomicUpdate(el, () => {
            meta.status = STATUS.LOADING;
            el.dataset.llStatus = STATUS.LOADING;
        });

        logManager.log(`LazyLoad [LOAD_START] 正在请求: ${currentKey.slice(0, 50)}...`, 'info');

        meta.lastKey = currentKey;

        const tag = el.tagName;
        if (tag === 'IMG') this.loadImg(el, currentRequestId);
        else if (tag === 'VIDEO' || tag === 'IFRAME') this.loadMedia(el, currentRequestId);
        else if (el.dataset.bg) this.loadBg(el, currentRequestId);
    }

    /** 加载图片资源 */
    loadImg(el, requestId) {
        const {src, srcset} = el.dataset;
        if (!src) return;

        this.cancelImageRequest(el);

        const temp = new Image();
        el.__lazyImg = temp;

        temp.onload = () => {
            const meta = this._getMeta(el);
            if (requestId !== meta.requestId) return; // 拦截旧请求回调

            if (srcset) el.srcset = srcset;
            el.src = src;

            logManager.log(`LazyLoad [SUCCESS] IMG 加载成功: ${src}`, 'info');
            this.setLoaded(el, requestId);
        };

        temp.onerror = () => {
            if (requestId !== this._getMeta(el).requestId) return;
            logManager.log(`LazyLoad [ERROR] IMG 加载失败: ${src}`, 'error');
            this.setError(el);
        };

        temp.src = src;
    }

    /** 清理图片加载句柄 */
    cancelImageRequest(el) {
        if (el.__lazyImg) {
            el.__lazyImg.onload = null;
            el.__lazyImg.onerror = null;
            el.__lazyImg.src = '';
            el.__lazyImg = null;
        }
    }

    /** 清理媒体监听器 */
    cancelMediaRequest(el) {
        if (el.__lazyMediaHandler) {
            el.removeEventListener('load', el.__lazyMediaHandler);
            el.removeEventListener('loadeddata', el.__lazyMediaHandler);
            el.__lazyMediaHandler = null;
        }
    }

    /** 加载视频或框架资源 */
    loadMedia(el, requestId) {
        let done = false;
        this.cancelMediaRequest(el);

        const handleLoad = () => {
            if (done || requestId !== this._getMeta(el).requestId) return;
            done = true;
            logManager.log(`LazyLoad [SUCCESS] MEDIA 加载完成`, 'info');
            this.setLoaded(el, requestId);
        };

        el.__lazyMediaHandler = handleLoad;
        el.addEventListener('load', handleLoad);
        el.addEventListener('loadeddata', handleLoad);

        if (el.dataset.src) {
            el.src = el.dataset.src;
        }

        if (el.tagName === 'VIDEO') {
            if (el.dataset.poster) el.poster = el.dataset.poster;
            el.load();
        }

        // Iframe 兜底逻辑: 防止某些无 onload 的情况
        if (el.tagName === 'IFRAME') {
            setTimeout(handleLoad, 5000);
        }
    }

    /** 加载背景图资源 */
    loadBg(el, requestId) {
        const bg = el.dataset.bg;
        this.cancelImageRequest(el);

        const temp = new Image();
        el.__lazyImg = temp;

        temp.onload = () => {
            if (requestId !== this._getMeta(el).requestId) return;
            el.style.backgroundImage = `url("${bg}")`;
            logManager.log(`LazyLoad [SUCCESS] BG 加载成功: ${bg}`, 'info');
            this.setLoaded(el, requestId);
        };

        temp.onerror = () => {
            if (requestId !== this._getMeta(el).requestId) return;
            logManager.log(`LazyLoad [ERROR] BG 加载失败: ${bg}`, 'error');
            this.setError(el);
        };

        temp.src = bg;
    }

    /** 加载成功后的清理与标记 */
    setLoaded(el, requestId) {
        const meta = this._getMeta(el);
        if (requestId !== meta.requestId) return;

        this.unobserve(el);

        this._atomicUpdate(el, () => {
            meta.status = STATUS.LOADED;
            el.dataset.llStatus = STATUS.LOADED;

            const originalStyle = el.llOriginalAttrs?.style;
            if (originalStyle !== undefined) {
                if (originalStyle === null) el.removeAttribute('style');
                else el.setAttribute('style', originalStyle);
            }
        });

        el.classList.remove('image_load_error');
        el.style.cursor = '';
        this.cancelImageRequest(el);

        el.dispatchEvent(new CustomEvent('lazyloaded', {detail: {el}}));
        setTimeout(updateFocusableElements, 10);
    }

    /** 加载失败处理：显示错误图并绑定点击重试 */
    setError(el) {
        const meta = this._getMeta(el);

        this._atomicUpdate(el, () => {
            meta.status = STATUS.ERROR;
            el.dataset.llStatus = STATUS.ERROR;
        });

        const errorImg = this.images.error;
        if (el.tagName === 'IMG') el.src = errorImg;
        else if (el.tagName === 'VIDEO') el.poster = errorImg;
        else if (el.dataset.bg) el.style.backgroundImage = `url("${errorImg}")`;

        el.classList.add('image_load_error');
        el.style.cursor = 'pointer';

        if (el.__lazyRetryHandler) {
            el.removeEventListener('click', el.__lazyRetryHandler);
        }

        el.__lazyRetryHandler = (e) => {
            e.stopPropagation();
            const meta = this._getMeta(el);
            if (meta.status !== STATUS.ERROR) return;
            logManager.log(`LazyLoad [USER_RETRY] 用户点击重试`, 'warn');
            if (el.tagName === 'IMG') el.src = el.dataset.placeholder;
            this.load(el, true);
        };

        el.addEventListener('click', el.__lazyRetryHandler);
        setTimeout(updateFocusableElements, 10);
    }

    /** 重试所有当前实例管辖下的错误资源 */
    retryAllErrors() {
        logManager.log(`LazyLoad [NETWORK_RECOVERY] 尝试自动重试错误资源`, 'warn');

        document.querySelectorAll(`${this.selector}[data-ll-status="${STATUS.ERROR}"]`).forEach(el => {
            const metaMap = el.__lazyMetaMap;
            if (metaMap && metaMap.has(this.id)) {
                this.load(el, true);
            }
        });
    }

    /** 恢复元素的原始 DOM 属性 */
    restoreAll() {
        document.querySelectorAll(this.selector).forEach(el => {
            if (!el.__lazyMetaMap?.has(this.id)) return;
            if (!el.llOriginalAttrs) return;

            const {src, srcset, poster} = el.llOriginalAttrs;
            this._atomicUpdate(el, () => {
                if (src) el.src = src;
                if (srcset) el.srcset = srcset;
                if (poster) el.poster = poster;
                el.classList.remove('image_load_error');
                el.style.cursor = '';
                if (el.dataset.bg) el.style.removeProperty('background-image');
                this._getMeta(el).status = STATUS.INIT;
                el.llOriginalAttrs = null;
            });
        });
    }

    /** 销毁实例，解绑观察并可选恢复 DOM */
    destroy({restore = false} = {}) {
        logManager.log(`LazyLoad [DESTROY] 实例销毁, 恢复模式: ${restore}`, 'warn');

        if (this.observer) this.observer.disconnect();
        if (this.mutationObserver) this.mutationObserver.disconnect();
        window.removeEventListener('online', this.handleOnline);

        document.querySelectorAll(this.selector).forEach(el => {
            if (!el.__lazyMetaMap?.has(this.id)) return;

            this.cancelImageRequest(el);
            this.cancelMediaRequest(el);

            if (el.__lazyRetryHandler) {
                el.removeEventListener('click', el.__lazyRetryHandler);
                delete el.__lazyRetryHandler;
            }

            this.unobserve(el);

            if (!restore) {
                this._atomicUpdate(el, () => {
                    delete el.dataset.llStatus;
                    delete el.dataset.placeholder;
                    el.llOriginalAttrs = null;
                });
            }
        });

        if (restore) this.restoreAll();
    }
}

/**
 * 自动注入管理
 */
// if (typeof window !== "undefined") {
//     window.__OREUI_LAZY_INSTANCES__ = window.__OREUI_LAZY_INSTANCES__ || [];
//
//     const opts = window.lazyLoadOptions || {};
//     if (opts.autoInit) {
//         const instance = new LazyLoad(opts.selector || 'img.lazy, .lazy-bg', opts);
//         window.__OREUI_LAZY_INSTANCES__.push(instance);
//         document.readyState === 'loading'
//             ? window.addEventListener('DOMContentLoaded', () => instance.init())
//             : instance.init();
//     }
// }