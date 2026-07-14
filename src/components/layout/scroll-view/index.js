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

// 节流函数,防止事件频繁触发
function throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
        const now = new Date().getTime();
        if (now - lastCall < delay) return;
        lastCall = now;
        return func(...args);
    };
}

// 自定义滚动条
// 处理滚动条显示逻辑
function showScroll(customScrollbar) {
    if (customScrollbar._scrollHideTimeout) {
        clearTimeout(customScrollbar._scrollHideTimeout); // 清除之前的隐藏定时器
    }
    customScrollbar.style.opacity = '1'; // 显示滚动条

    if (!window.OreUI_MaskFullyHidden) {
        return;
    }
    customScrollbar._scrollHideTimeout = setTimeout(() => {
        customScrollbar.style.opacity = '0'; // 3秒后隐藏滚动条
    }, 3000);
}

// 更新滚动条滑块位置和尺寸
function updateThumb(thumb, container, content, customScrollbar) {
    const scrollHeight = content.scrollHeight; // 滚动区域的总高度
    const containerHeight = container.getBoundingClientRect().height; // 滚动区域的显示高度
    // 如果容器高度为0直接返回
    if (containerHeight === 0) return;
    // 内容未溢出或滚动区域过小则隐藏滚动条并返回
    if (Math.round(scrollHeight) <= Math.round(containerHeight)) { // 解决计算精度不同导致的问题
        customScrollbar.style.display = 'none';
        return;
    } else {
        customScrollbar.style.display = 'block';
    }
    const thumbHeight = Math.max((containerHeight / scrollHeight) * containerHeight, 35); // 滑块的高度 最小高度35px,防止滚动条过小
    const maxContentScroll = scrollHeight - containerHeight; // 滑块能到达的最大位置
    const currentScrollTop = Math.round(container.scrollTop); // 当前的滑块位置
    let thumbPosition, thumbTrackSpace;
    if (content.classList.contains('main_with_tab_bar')) customScrollbar.style.top = '100px'; // 这里需要给标签栏预留高度
    if (customScrollbar.classList.contains('primary_oreui_scrollbar')) {
        thumbTrackSpace = containerHeight - (thumbHeight + 4); // 4为主要滑块的上下边框高度
    } else {
        thumbTrackSpace = containerHeight - thumbHeight; // 次要滑块没有边框样式
    }
    if (maxContentScroll > 0 && thumbTrackSpace > 0) { // 确保有滚动空间和滑块移动空间
        thumbPosition = (currentScrollTop / maxContentScroll) * thumbTrackSpace;
        thumbPosition = Math.max(0, Math.min(thumbPosition, thumbTrackSpace)); // 限制滑块在有效范围内
    } else {
        thumbPosition = 0; // 滑块置于顶部
    }
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.top = `${thumbPosition}px`;
    customScrollbar.style.height = `${containerHeight}px`;
}

// 处理滚动条点击跳转
function handleScrollbarClick(e, isDragging, customScrollbar, thumb, container, content) {
    if (isDragging || customScrollbar.classList.contains('secondary_oreui_scrollbar')) return; // 次要滚动条和拖动中的主要滚动条不能点击跳转

    const {top: scrollbarClientRectTop, height: scrollbarActualHeight} = customScrollbar.getBoundingClientRect();
    const clickClientY = e.clientY;
    const clickPositionInScrollbar = clickClientY - scrollbarClientRectTop;
    const thumbVisualHeight = thumb.offsetHeight; // 滑块的实际可见高度
    const containerVisibleHeight = container.getBoundingClientRect().height;
    const contentScrollHeight = content.scrollHeight;
    const maxContentScroll = contentScrollHeight - containerVisibleHeight;
    if (maxContentScroll <= 0) return;

    const thumbCurrentOffsetTop = thumb.offsetTop; // 滑块相对于其父元素的顶部
    if (clickPositionInScrollbar < thumbCurrentOffsetTop || clickPositionInScrollbar > (thumbCurrentOffsetTop + thumbVisualHeight)) {
        let scrollbarTrackEffectiveHeight = scrollbarActualHeight - (thumbVisualHeight + 4); // 4为主要滑块的上下边框高度

        if (scrollbarTrackEffectiveHeight <= 0) return;

        let targetThumbTop = clickPositionInScrollbar - (thumbVisualHeight / 2); // 让点击点作为新的滑块位置中点
        targetThumbTop = Math.max(0, Math.min(targetThumbTop, scrollbarTrackEffectiveHeight)); // 将滑块限制在轨道内
        const newScrollTop = (targetThumbTop / scrollbarTrackEffectiveHeight) * maxContentScroll; // 根据新的滑块位置计算内容的滚动高度
        container.scrollTop = Math.round(newScrollTop);
    }
}

// 处理滚动事件
function handleScroll(customScrollbar, customThumb, container, content) {
    if (!customScrollbar || !customThumb) return;

    showScroll(customScrollbar);
    requestAnimationFrame(() => { // 动画优化
        updateThumb(customThumb, container, content, customScrollbar);
    });
}

// 处理拖动滚动条的逻辑
function handlePointerMove(e, dragState, thumb, container, content, customScrollbar) {
    if (!dragState.isDragging || customScrollbar.classList.contains('secondary_oreui_scrollbar')) return; // 次要滚动条不能拖动

    const currentY = e.clientY || (e.touches && e.touches[0].clientY);
    const deltaY = currentY - dragState.startY;
    const containerHeight = container.getBoundingClientRect().height; // 根据初始位置和移动距离计算新的滑块位置
    const thumbHeight = thumb.offsetHeight;
    const maxThumbTop = containerHeight - thumbHeight;
    const newTop = Math.min(Math.max(dragState.initialThumbTop + deltaY, 0), maxThumbTop); // 计算滑块的新位置,确保在可滑动范围内
    const maxScrollTop = content.scrollHeight - containerHeight; // 计算页面内容的滚动位置

    container.scrollTo({
        top: (newTop / maxThumbTop) * maxScrollTop, behavior: 'instant' // 滚动时不产生动画
    });

    updateThumb(thumb, container, content, customScrollbar);
}

function handlePointerDown(e, customThumb, container, content, dragState, customScrollbar) {
    dragState.isDragging = true;
    dragState.startY = e.clientY || (e.touches && e.touches[0].clientY);
    dragState.initialThumbTop = customThumb.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const handlePointerMoveBound = (e) => handlePointerMove(e, dragState, customThumb, container, content, customScrollbar);

    document.addEventListener('pointermove', handlePointerMoveBound, { passive: false });
    document.addEventListener('touchmove', handlePointerMoveBound, { passive: false });
    const handlePointerUp = () => {
        dragState.isDragging = false;
        document.removeEventListener('pointermove', handlePointerMoveBound);
        document.removeEventListener('touchmove', handlePointerMoveBound);
    };
    document.addEventListener('pointerup', handlePointerUp, {once: true});
    document.addEventListener('touchend', handlePointerUp, {once: true});
}

// 绑定滚动事件的通用函数,使用节流处理滚动事件
export function bindScrollEvents(container, content, customScrollbar, customThumb) {
    const dragState = {isDragging: false, startY: 0, initialThumbTop: 0}; // 使用对象管理拖动状态

    const throttledUpdateAndShowScroll = throttle(() => {
        handleScroll(customScrollbar, customThumb, container, content);
    }, 1); // 使用节流函数优化性能(需要即时响应计算的场景)

    const throttledShowOnly = throttle(() => {
        showScroll(customScrollbar);
    }, 100); // 使用节流函数优化性能(仅需显示滚动条的场景)

    // 自定义滚动条精确滚动
    customScrollbar.addEventListener('wheel', (e) => {
        let delta = e.deltaY > 0 ? 10 : -10;
        container.scrollTop += delta;
        throttledUpdateAndShowScroll();
        e.preventDefault();
    });

    // 仅需要显示滚动条的事件
    document.addEventListener('mousemove', throttledShowOnly);
    document.addEventListener('touchmove', throttledShowOnly);
    // 需要显示和更新滚动条的事件
    container.addEventListener('scroll', throttledUpdateAndShowScroll);
    window.addEventListener('resize', throttledUpdateAndShowScroll);
    customThumb.addEventListener('pointerdown', (e) => handlePointerDown(e, customThumb, container, content, dragState, customScrollbar));
    customThumb.addEventListener('touchstart', (e) => {
        handlePointerDown(e, customThumb, container, content, dragState, customScrollbar);
    }, { passive: false });
    customScrollbar.addEventListener('click', (e) => handleScrollbarClick(e, dragState.isDragging, customScrollbar, customThumb, container, content));
    window.addEventListener('mask-hidden-complete', () => {
        showScroll(customScrollbar);
    });
}

// 获取并处理所有滚动容器
export function initializeScrollContainers() {
    const containers = document.querySelectorAll('.primary_scroll_container, .secondary_scroll_container');

    containers.forEach((container) => {
        // 为当前容器查询核心滚动元素
        const contentElement = container.querySelector('.scroll_container, .sidebar_content, oreui-sidebar-content');
        if (!contentElement) return; // 安全检查

        const scrollViewElement = contentElement.closest('oreui-scroll-view');
        if (!scrollViewElement) return;

        const customScrollbarElement = scrollViewElement.querySelector('oreui-scrollbar');
        const customThumbElement = customScrollbarElement.querySelector('oreui-scrollbar-thumb');
        bindScrollEvents(container, contentElement, customScrollbarElement, customThumbElement); // 为所有容器绑定标准的滚动事件

        // 监听元素尺寸变化
        const ScrollHandlerForResize = createHandleScroll(customScrollbarElement, customThumbElement, container, contentElement);
        const throttledScrollHandler = throttle(ScrollHandlerForResize, 1);
        const observer = new ResizeObserver(() => {
            throttledScrollHandler();
        }); // 创建ResizeObserver实例
        observer.observe(container); // 观察主容器本身
        observer.observe(contentElement); // 同时观察其内容元素
    });
}

// 初始化滚动容器
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
        initializeScrollContainers();
    });
}

// 使用带有内部状态的滚动处理闭包函数
export function createHandleScroll(customScrollbar, customThumb, container, content) {
    return function () {
        handleScroll(customScrollbar, customThumb, container, content);
    };
}

// 导出滚动容器
export function getMainScrollContainer() {
    return document.querySelector('.primary_scroll_container');
}

/**
 * 导出主滚动容器的快捷操作 (如果存在)
 * NOTE 在有涉及到自定义高度变化的地方要调用这个代码
 */
export const getMainHandleScroll = () => {
    const mainScrollContainer = document.querySelector('.primary_scroll_container');
    const scrollContent = document.querySelector('.scroll_container');
    if (!mainScrollContainer || !scrollContent) return () => {
    };

    const scrollView = scrollContent.closest('oreui-scroll-view');
    const scrollbar = scrollView.querySelector('oreui-scrollbar');
    const thumb = scrollView.querySelector('oreui-scrollbar-thumb');

    return throttle(createHandleScroll(scrollbar, thumb, mainScrollContainer, scrollContent), 1);
};
