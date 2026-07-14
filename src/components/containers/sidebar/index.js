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

import {logManager} from "@/javascript/public_define.js";
import {updateFocusableElements} from "@components/design/accessibility/index.js";

class OreUI_Sidebar extends HTMLElement {
    constructor() {
        super();
        this._overlayElement = null;
        this._mediaQuery = window.matchMedia('(min-width: 1200px)');
        this._boundMediaQueryHandler = this._notifyChange.bind(this);
        this._animatingDirection = null;
        this._animationTimeout = null;
    }

    static get observedAttributes() {
        return ['data-state'];
    }

    connectedCallback() {
        // 侧边栏初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._initComponent());
        } else {
            setTimeout(() => this._initComponent(), 0);
        }

        // 响应式设计
        if (this._mediaQuery.addEventListener) {
            this._mediaQuery.addEventListener('change', this._boundMediaQueryHandler);
        } else {
            this._mediaQuery.addListener(this._boundMediaQueryHandler);
        }
    }

    disconnectedCallback() {
        if (this._mediaQuery.removeEventListener) {
            this._mediaQuery.removeEventListener('change', this._boundMediaQueryHandler);
        } else {
            this._mediaQuery.removeListener(this._boundMediaQueryHandler);
        }
        if (this._animationTimeout) clearTimeout(this._animationTimeout);
    }

    _initComponent() {
        if (!this._overlayElement) {
            // 全局数据驱动初始化
            const overlay = document.createElement('oreui-sidebar-mask');
            overlay.setAttribute('data-event', 'changeSidebarState');
            this.insertBefore(overlay, this.firstChild);
            this._overlayElement = overlay;
        }
        this._notifyChange();
        this.updateState(this.getAttribute('data-state') || 'closed');
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name === 'data-state') {
            this.updateState(newValue);
            this._notifyChange();
        }
    }

    _notifyChange() {
        const event = new CustomEvent('oreui-sidebar-sync', {
            bubbles: true,
            composed: true,
            detail: {
                isLargeScreen: this._mediaQuery.matches,
                isOpen: this.getAttribute('data-state') === 'open'
            }
        });
        this.dispatchEvent(event);
    }

    updateState(state) {
        if (typeof updateFocusableElements === 'function') {
            setTimeout(updateFocusableElements, 10);
        }
        logManager.log(`侧边栏状态同步更新为: ${state}`);
    }

    /**
     * 统一的状态切换入口
     * @param {Event} [e] - 传入原生点击事件以识别点击源
     */
    toggleState(e) {
        // 通过冒泡链路识别点击源头是否为遮罩层
        const isClickedMask = e && e.target && !!e.target.closest('oreui-sidebar-mask');
        const currentState = this.getAttribute('data-state') || 'closed';

        // 拦截事件判定
        if (this._animatingDirection !== null) {
            if (isClickedMask) {
                // 如果侧边栏正在收起则拦截遮罩点击事件,防止误触
                if (this._animatingDirection === 'closing') {
                    return;
                }
                // 如果侧边栏正在展开则执行遮罩点击事件
                if (this._animatingDirection === 'opening') {
                    logManager.log("侧边栏展开时点击遮罩,收起遮罩");
                }
            }
        }

        // 计算常规目标状态并执行驱动
        const nextState = (currentState === 'open') ? 'closed' : 'open';
        const nextDirection = (nextState === 'open') ? 'opening' : 'closing';
        this._executeTransition(nextState, nextDirection);
    }

    /**
     * 底层状态变更与动画趋势锁控制
     */
    _executeTransition(targetState, direction) {
        if (this._animationTimeout) clearTimeout(this._animationTimeout);

        this._animatingDirection = direction;
        this.classList.add('is_animating');
        this.setAttribute('data-state', targetState);

        // 刷新响应式布局
        window.dispatchEvent(new Event('resize'));

        // 动画结束后平稳解锁复位
        this._animationTimeout = setTimeout(() => {
            this.classList.remove('is_animating');
            this._animatingDirection = null;
            window.dispatchEvent(new Event('resize'));
        }, 600);
    }
}

// 辅助子组件注册
class OreUI_SidebarItem extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const level = this.getAttribute('data-level') || '1';
        const anchor = this.getAttribute('data-anchor') || 'javascript:void(0);';
        const textContent = this.textContent.trim();
        const aLink = document.createElement('a');
        const oreuiList = document.createElement('oreui-list');
        this.textContent = '';
        aLink.className = 'sidebar_item';
        aLink.href = anchor;
        oreuiList.setAttribute('data-level', level);
        oreuiList.textContent = textContent;
        aLink.appendChild(oreuiList);
        this.appendChild(aLink);
    }
}

class OreUI_SidebarContent extends HTMLElement {
}

class OreUI_SidebarHeader extends HTMLElement {
}

class OreUI_SidebarList extends HTMLElement {
}

class OreUI_SidebarInfo extends HTMLElement {
}

class OreUI_SidebarDivider extends HTMLElement {
}

class OreUI_SidebarTitle extends HTMLElement {
}

class OreUI_SidebarDetail extends HTMLElement {
}

class OreUI_SidebarMask extends HTMLElement {
}

(() => {
    const components = {
        'oreui-sidebar': OreUI_Sidebar,
        'oreui-sidebar-item': OreUI_SidebarItem,
        'oreui-sidebar-content': OreUI_SidebarContent,
        'oreui-sidebar-header': OreUI_SidebarHeader,
        'oreui-sidebar-list': OreUI_SidebarList,
        'oreui-sidebar-info': OreUI_SidebarInfo,
        'oreui-sidebar-divider': OreUI_SidebarDivider,
        'oreui-sidebar-title': OreUI_SidebarTitle,
        'oreui-sidebar-detail': OreUI_SidebarDetail,
        'oreui-sidebar-mask': OreUI_SidebarMask
    };

    Object.entries(components).forEach(([tagName, componentClass]) => {
        if (!customElements.get(tagName)) {
            customElements.define(tagName, componentClass);
        }
    });
})();

/**
 * 公共接口函数
 */
export function changeSidebarState(e) {
    const sidebar = document.getElementById('sidebar') || document.querySelector('oreui-sidebar');
    if (!sidebar || typeof sidebar.toggleState !== 'function') return;

    sidebar.toggleState(e);
}
