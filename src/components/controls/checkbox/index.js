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

import checkmarkIcon from '@assets/images/check_white.png';
import {logManager} from "@/javascript/public_define.js";
import {playSound} from '@/javascript/public_script.js';
import {updateFocusableElements} from "@components/design/accessibility/index.js";

class CustomCheckbox extends HTMLElement {
    constructor() {
        super();
        this.beforeToggle = null;
    }

    static get observedAttributes() {
        return ['status', 'active'];
    }

    connectedCallback() {
        this.render();
        this.addEventListener('click', (e) => this.toggleCheckbox(e));
    }

    attributeChangedCallback() {
        this.render();
        setTimeout(updateFocusableElements, 10); // 更新元素焦点
    }

    render() {
        const active = this.getAttribute('active') || 'off';
        const status = this.getAttribute('status') || 'enabled';
        const isOn = active === 'on';
        const isDisabled = status !== 'enabled';

        this.innerHTML = `
            <div class="custom-checkbox ${isOn ? 'on' : 'off'} ${isDisabled ? 'disabled' : 'enabled'}">
                ${isOn ? `<img alt="" class="checkmark" src="${checkmarkIcon}"/>` : ''}
            </div>
        `;
    }

    async toggleCheckbox() {
        if (this.getAttribute('status') !== 'enabled') return;

        // 执行钩子检查
        if (typeof this.beforeToggle === 'function' && !this.beforeToggle(this)) {
            logManager.log(`复选框 ${this.id} 的切换被拦截器阻止`, 'warn');
            return;
        }

        const currentActive = this.getAttribute('active') === 'on';
        const newActive = currentActive ? 'off' : 'on';

        // 触发音效
        await playSound('click').catch(() => {});

        const logAction = newActive === 'on' ? '打开' : '关闭';
        logManager.log(`${logAction}复选框: ${this.id}`);

        // 更新状态
        this.setAttribute('active', newActive);

        // 抛出事件
        this.dispatchEvent(new CustomEvent('checkbox-change', {
            bubbles: true,
            detail: {id: this.id, active: newActive}
        }));
    }
}

export {CustomCheckbox};

if (!customElements.get('custom-checkbox')) {
    customElements.define('custom-checkbox', CustomCheckbox);
}