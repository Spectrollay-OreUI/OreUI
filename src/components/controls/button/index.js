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
 * @Component    : OreUI-Button
 * @Version      : 1.0.0
 * @Description  : OreUI原生按钮组件
 * ========================================================================== */

import {logManager} from "@/javascript/public_define.js";
import {updateFocusableElements} from "@components/design/accessibility/index.js";
import {playSound} from "@/javascript/public_script.js";


export class OreUIButton extends HTMLElement {
    constructor() {
        super();
        this._timer = null;
        this._btnElement = null;
        this._textNode = null;
    }

    static get observedAttributes() {
        return ['type', 'status', 'size', 'text', 'icon', 'icon-position', 'tip', 'data-event', 'countdown'];
    }

    connectedCallback() {
        this.render();
        if (this.hasAttribute('countdown')) {
            this.startCountdown(parseInt(this.getAttribute('countdown'), 10));
        }

        // 点击事件
        this.addEventListener('click', async (e) => {
            const status = this.getAttribute('status') || 'normal';

            // 判定是否为禁用的按钮
            if (status === 'disabled') {
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
            }

            // 按钮点击音效判定
            const soundType = (status === 'green') ? 'button' : 'click';
            playSound(soundType).catch(err => {
                logManager.log(`按钮音效播放失败: ${err.message}`, 'warn');
            });

            // 状态流转
            const text = this.getAttribute('text') || '';
            const event = this.getAttribute('data-event') || '';
            logManager.log(`点击按钮: ${text} | 触发音效: ${soundType}`);
            this.dispatchEvent(new CustomEvent('button-click', {
                detail: {text, event, id: this.id},
                bubbles: true,
                composed: true
            }));
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        if (name === 'text' && this._textNode) {
            this._textNode.textContent = newValue;
        } else if (name === 'status' && this._btnElement) {
            this.updateStatus(newValue);
        } else {
            this.render();
        }
    }

    updateStatus(status) {
        const isDisabled = status === 'disabled';
        this._btnElement.className = this.getButtonClass(status);
        this._btnElement.disabled = isDisabled;

        if (typeof updateFocusableElements === 'function') {
            setTimeout(updateFocusableElements, 10);
        }
    }

    getButtonClass(status) {
        const size = this.getAttribute('size') || 'middle';
        const type = this.getAttribute('type') || 'default';

        return [
            'oreui_btn_inner',
            `size_${size}`,
            `status_${status}`,
            type !== 'default' ? `type_${type}` : ''
        ].filter(Boolean).join(' ');
    }

    // 计时器
    startCountdown(seconds) {
        if (this._timer) clearInterval(this._timer);

        let remaining = seconds;
        const originalText = this.getAttribute('text') || '';
        const originalStatus = this.getAttribute('status') || 'normal';

        this.setAttribute('status', 'disabled');
        this.setAttribute('text', `${originalText}(${remaining}s)`);

        this._timer = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                this.setAttribute('text', `${originalText}(${remaining}s)`);
            } else {
                clearInterval(this._timer);
                this.setAttribute('status', originalStatus);
                this.setAttribute('text', originalText);
                this.removeAttribute('countdown');
                this.dispatchEvent(new CustomEvent('countdown-finish', {bubbles: true}));
            }
        }, 1000);
    }

    render() {
        this.textContent = '';
        const text = this.getAttribute('text') || '';
        const tip = this.getAttribute('tip') || '';
        const icon = this.getAttribute('icon') || '';
        const iconPos = this.getAttribute('icon-position') || 'left';
        const status = this.getAttribute('status') || 'normal';
        const isDisabled = status === 'disabled';

        // 创建核心按钮类
        const btn = document.createElement('button');
        this._btnElement = btn;
        btn.className = this.getButtonClass(status);
        if (isDisabled) btn.disabled = true;

        if (icon) {
            const img = document.createElement('img');
            img.className = `oreui_btn_icon ${iconPos}`;
            img.src = new URL(`../../../assets/images/${icon}.png`, import.meta.url).href;
            if (iconPos === 'left') btn.appendChild(img);
        }

        this._textNode = document.createTextNode(text);
        btn.appendChild(this._textNode);

        if (icon && iconPos === 'right') {
            const img = document.createElement('img');
            img.className = `oreui_btn_icon ${iconPos}`;
            img.src = new URL(`../../../assets/images/${icon}.png`, import.meta.url).href;
            btn.appendChild(img);
        }

        // 处理外层提示包裹逻辑
        if (tip) {
            const container = document.createElement('div');
            container.className = 'oreui_btn_tooltip_wrapper';

            const tooltip = document.createElement('div');
            tooltip.className = 'oreui_btn_tooltip_box';
            tooltip.textContent = tip;

            container.appendChild(btn);
            container.appendChild(tooltip);
            this.appendChild(container);
        } else {
            this.appendChild(btn);
        }
    }

    disconnectedCallback() {
        if (this._timer) clearInterval(this._timer);
    }
}

if (!customElements.get('oreui-button')) {
    customElements.define('oreui-button', OreUIButton);
}
