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
 * OreUI无障碍模块
 * 无障碍增强/焦点锁陷阱/全局交互修正
 * ========================================================================== */

import {logManager, Repo_Name} from "@/javascript/public_define.js";

// 从本地存储恢复当前的无障碍开关状态映射表
export const switchValues = JSON.parse(localStorage.getItem(`(${Repo_Name})switch_value`)) || {};


/**
 * --- 无障碍焦点选择器映射表 ---
 */

// 不需要或被强制剥夺键盘Tab焦点的元素列表
const exclusionSelectors = [
    'button',
    '.overlay',
    'modal_area',
    'modal_content',
    'modal_checkbox_area .custom-checkbox',
    'textarea',
    '.zoom_mask',
    'oreui-sidebar-item a'
];

// 需要被赋予键盘Tab聚焦并模拟点击行为的元素列表
const inclusionSelectors = [
    '.clickable_no_link',
    'oreui-header-item:not(.header_item_blank)',
    '#banner_tip',
    '.image_load_error',
    'modal_close_btn',
    '.edition_block',
    'oreui-sidebar-item',
    'oreui-show-block',
    '.btn:not(.disabled_btn)',
    '.tab_bar_btn',
    '.expandable_card',
    '.plan_block',
    '.custom-checkbox:not(.disabled)',
    '.switch:not(.disabled_switch) .switch_slider',
    '.slider_slider:not(.disabled_slider)',
    '.dropdown_label:not(.disabled_dropdown)',
    '.dropdown_option',
    'text-field:not(.disabled_text_field) textarea',
    '.share_img_title',
    '.output_code.selectable',
    '.zoom_close_btn',
    '.zoom_theme_btn'
];

// 统一合并为标准的选择器字符串
const exclusionSelectorString = exclusionSelectors.join(', ');
const inclusionSelectorString = inclusionSelectors.join(', ');


/**
 * --- 全局元素行为修正与底层判定 ---
 */

/**
 * 修正原生元素的默认高危行为
 */
export function fixGlobalElementBehavior() {
    // 禁止部分元素的拖拽行为
    const cantDraggableElements = document.querySelectorAll('img, a');
    cantDraggableElements.forEach(el => {
        if (el) el.draggable = false;
    });
}

/**
 * 为不支持键盘交互的元素模拟点击行为
 * @param {KeyboardEvent} e - 键盘事件对象
 */
function handleEnterPress(e) {
    if (e.key === 'Enter') {
        if (e.target && typeof e.target.click === 'function') {
            e.target.click();
        }
        e.stopPropagation(); // 阻止事件冒泡,防止多层组件联动误触发
        e.preventDefault();  // 阻止浏览器可能发生的默认行为
    }
}

/**
 * 判定元素在当前DOM树中是否真实可见可聚焦
 * @param {HTMLElement} e - 待检测的页面DOM元素
 * @return {boolean} 是否允许聚焦
 */
function isElementActuallyFocusable(e) {
    if (!e || typeof e.focus !== 'function' || e.hasAttribute('disabled')) return false;
    if (e.getAttribute('tabindex') === '-1') return false;

    try {
        // 即使元素存在,若它的父级被隐藏依旧无法聚焦
        // 我通过getComputedStyle和getClientRects做流式双重防御检查
        const style = window.getComputedStyle(e);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
        if (e.getClientRects().length === 0) return false;
    } catch (e) {
        return false;
    }
    return true;
}


/**
 * --- Tabindex属性管理与核心状态机同步 ---
 */

/**
 * 批量清洗并设置元素的tabindex属性,同时动态绑定/解绑回车事件
 * @param {NodeListOf<Element>} inclusionList - 允许聚焦的元素集合
 * @param {NodeListOf<Element>} exclusionList - 剥夺焦点的元素集合
 */
export function setElementsTabindex(inclusionList, exclusionList) {
    if (exclusionList) {
        exclusionList.forEach(el => el && el.setAttribute('tabindex', '-1'));
    }
    if (inclusionList) {
        inclusionList.forEach(el => {
            if (el) {
                el.setAttribute('tabindex', '0');
                el.removeEventListener('keyup', handleEnterPress); // 绑定前必须先移除一次,防止事件重绑引发多次触发
                el.addEventListener('keyup', handleEnterPress);
            }
        });
    }
}

/**
 * 分析指定父元素内的所有子节点,计算并提取焦点停靠点边界
 * @param {HTMLElement} parentElement - 宿主父容器
 * @return {{firstTabStop: HTMLElement|null, lastTabStop: HTMLElement|null, focusableList: Array}} 焦点边界对象
 */
export function chooseElementsTabindex(parentElement) {
    if (!parentElement || typeof parentElement.querySelectorAll !== 'function') {
        logManager.log("提供焦点选择的父元素无效!", 'error');
        return {firstTabStop: null, lastTabStop: null, focusableList: []};
    }

    const localExclusionElements = parentElement.querySelectorAll(exclusionSelectorString);
    const localInclusionElements = parentElement.querySelectorAll(inclusionSelectorString);

    setElementsTabindex(localInclusionElements, localExclusionElements);

    // 基于可见性过滤器,线性筛选出真实可以承载焦点的集合
    const focusableList = Array.from(localInclusionElements).filter(isElementActuallyFocusable);
    const firstTabStop = focusableList[0] || null;
    const lastTabStop = focusableList[focusableList.length - 1] || null;

    return {firstTabStop, lastTabStop, focusableList};
}

/**
 * 全局更新页面元素的焦点状态
 * NOTE: 在任何有异步渲染或界面结构发生增删改变化的地方都需要手动调用此函数
 */
export function updateFocusableElements() {
    const globalExclusionElements = document.querySelectorAll(exclusionSelectorString);
    const globalInclusionElements = document.querySelectorAll(inclusionSelectorString);
    setElementsTabindex(globalInclusionElements, globalExclusionElements);
}


/**
 * --- 区域无障碍焦点陷阱拦截引擎 ---
 */

/**
 * Tab键环形导航处理器
 * @param {KeyboardEvent} e - 键盘事件
 */
export function handleTabNavigation(e) {
    const trappingElement = e.currentTarget;
    if (!trappingElement || e.key !== 'Tab') return;

    const {focusableList, firstTabStop, lastTabStop} = chooseElementsTabindex(trappingElement);
    if (!focusableList.length) {
        e.preventDefault();
        return;
    }

    const currentActiveElement = document.activeElement;
    const currentIndex = focusableList.indexOf(currentActiveElement);
    e.preventDefault(); // 阻止浏览器的原生焦点转移,接管系统的Tab行为

    let nextFocusElement;

    if (e.shiftKey) {
        // Shift + Tab 逆向循环导航
        if (currentIndex <= 0) {
            nextFocusElement = lastTabStop; // 触碰上边界,回滚到容器最后一位
        } else {
            nextFocusElement = focusableList[currentIndex - 1];
        }
    } else {
        // Tab 正向循环导航
        if (currentIndex === -1 || currentIndex === focusableList.length - 1) {
            nextFocusElement = firstTabStop; // 触碰下边界,折返回容器第一位
        } else {
            nextFocusElement = focusableList[currentIndex + 1];
        }
    }

    if (nextFocusElement) nextFocusElement.focus();
}

/**
 * 自动扫描页面中的所有Modal弹窗并绑定焦点锁
 */
export function initModalTraps() {
    const modals = document.querySelectorAll('modal');
    modals.forEach((modal) => {
        modal.removeEventListener('keydown', handleTabNavigation);
        modal.addEventListener('keydown', handleTabNavigation);

        // 当弹窗展现时焦点应自动强行切入到弹窗内部的第一个可操作组件上
        modal.addEventListener('shown.modal', () => {
            const {firstTabStop} = chooseElementsTabindex(modal);
            if (firstTabStop) firstTabStop.focus();
        });
    });
}


/**
 * --- 运行期全生命周期自动挂载入口 ---
 */
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        fixGlobalElementBehavior();
        updateFocusableElements();
        initModalTraps();
    });
}
