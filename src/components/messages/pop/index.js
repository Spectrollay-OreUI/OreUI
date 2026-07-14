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
 * @Component    : OreUI-Pop
 * @Version      : 1.0.0
 * @Description  : OreUI 全局气泡提示组件
 * ========================================================================== */

import {logManager} from "@/javascript/public_define.js";
import {playSound} from "@/javascript/public_script.js";

/**
 * 组件宿主容器元素
 * 用于统一包裹和管理页面上弹出的所有气泡
 */
class OreUIPopArea extends HTMLElement {
    constructor() {
        super();
    }
}

if (!customElements.get('oreui-pop-area')) {
    customElements.define('oreui-pop-area', OreUIPopArea);
}

/**
 * 单个气泡提示元素
 */
class OreUIPop extends HTMLElement {
    constructor() {
        super();
    }

    // 当组件被插入到页面时触发
    connectedCallback() {
        // 如果标签内部没有写文本, 就去读取 message 属性的值来填入内容
        if (!this.textContent.trim() && this.hasAttribute('message')) {
            this.textContent = this.getAttribute('message');
        }
    }

    // 获取页面上的容器, 如果找不到就自动在 body 里创建一个
    static getOrCreateArea() {
        let area = document.querySelector('oreui-pop-area');
        if (!area) {
            area = document.createElement('oreui-pop-area');
            document.body.appendChild(area);
        }
        return area;
    }
}

if (!customElements.get('oreui-pop')) {
    customElements.define('oreui-pop', OreUIPop);
}

/**
 * 外部调用的核心方法: 显示一个气泡提示
 * @param {string} message - 提示文本内容
 * @param {number} duration - 显示持续时间
 * @param {string} status - 状态类型
 */
export function showPop(message, duration, status = '') {
    // 获取或创建容纳气泡的父容器
    const area = OreUIPop.getOrCreateArea();

    // 创建气泡标签并填入内容与状态
    const pop = document.createElement('oreui-pop');
    if (status) {
        pop.setAttribute('status', status);
    }
    pop.textContent = message;

    // 检查并校正持续时间, 默认为 3 秒
    duration = Number(duration);
    if (!Number.isFinite(duration) || duration <= 0) {
        duration = 3000;
    }

    // 延迟 300ms 显示, 配合可能存在的排队或连击音效
    setTimeout(() => {
        // 将新气泡插到容器的最顶部
        area.prepend(pop);

        // 播放提示音效
        playSound('toast').catch(err => {
            logManager.log(`Pop 播放音频出错: ${err.message}`, 'warn');
        });

        // 利用 requestAnimationFrame 和 offsetHeight 强制让浏览器在添加属性前刷新一次样式
        // 如果不这么做, 浏览器会把创建标签和添加 [show] 属性合并在一次渲染里, 导致淡入动画失效
        requestAnimationFrame(() => {
            void pop.offsetHeight; // 触发浏览器重绘
            pop.setAttribute('show', ''); // 添加 show 属性激活 CSS 淡入动画
        });

        // 检查当前显示的气泡数量, 如果超过 5 个就隐藏最旧的
        manageVisiblePops(area);

        // 控制气泡的消隐与销毁生命周期
        setTimeout(() => {
            pop.removeAttribute('show'); // 移除 show 属性, 触发 CSS 淡出动画

            // 等待 300ms 的淡出动画播放完毕后, 再将标签从 DOM 中彻底移除
            setTimeout(() => {
                if (area.contains(pop)) {
                    area.removeChild(pop);
                    // 气泡被删掉后释放了位置, 检查并恢复之前被隐藏的未到期气泡
                    restoreHiddenPop(area);
                }
            }, 300);
        }, duration);
    }, 300);
}

/**
 * 数量上限控制: 防止屏幕上同时出现太多气泡占满空间
 * @param {HTMLElement} area - 气泡容器
 */
function manageVisiblePops(area) {
    const pops = Array.from(area.querySelectorAll('oreui-pop'));
    // 过滤出当前正在显示且带有 show 属性的活跃气泡
    const visiblePops = pops.filter(p => p.style.display !== 'none' && p.hasAttribute('show'));

    // 如果活着的可见气泡达到了 5 个或更多
    if (visiblePops.length >= 5) {
        // 从最老的气泡开始往前找, 隐藏第一个还在显示的气泡
        for (let i = pops.length - 1; i >= 0; i--) {
            const p = pops[i];
            if (p.style.display !== 'none' && p.hasAttribute('show')) {
                // 用 display: none 暂时隐藏, 不直接删掉是因为它的生存计时器还没跑完
                p.style.display = 'none';
                break;
            }
        }
    }
}

/**
 * 位置释放恢复: 当有旧气泡到期被删掉后让之前被挤到后台隐藏的气泡重新露面
 * @param {HTMLElement} area - 气泡容器
 */
function restoreHiddenPop(area) {
    const pops = Array.from(area.querySelectorAll('oreui-pop'));
    const visibleCount = pops.filter(p => p.style.display !== 'none' && p.hasAttribute('show')).length;

    // 如果当前屏幕上显示的活跃气泡少于 5 个
    if (visibleCount < 5) {
        // 倒序遍历找到最新被隐藏的那一个
        for (let i = pops.length - 1; i >= 0; i--) {
            const p = pops[i];
            if (p.style.display === 'none' && p.hasAttribute('show')) {
                p.style.display = ''; // 取消隐藏, 让它重新显示在屏幕上
                break;
            }
        }
    }
}
