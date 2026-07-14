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
 * OreUI加载模块
 * 负责处理页面初始化时的加载遮罩逻辑
 */

(function () {
    let isHidden = false;
    let mask = null;

    function getMask() {
        if (!mask) mask = document.querySelector('oreui-loading-mask');
        return mask;
    }

    function showMask(backgroundColor) {
        const el = getMask();
        if (!el) return;

        isHidden = false;
        el.style.transition = 'none';
        if (backgroundColor) {
            el.style.backgroundColor = backgroundColor;
        }
        el.style.display = 'flex';
        el.style.opacity = '1';

        el.offsetHeight;
    }

    function hideMask() {
        if (isHidden) return;
        isHidden = true;
        const el = getMask();
        if (!el) return;

        setTimeout(() => {
            el.style.transition = 'opacity 0.8s ease';
            el.style.opacity = '0';
            setTimeout(() => {
                el.style.display = 'none';
                window.OreUI_MaskFullyHidden = true;
                window.dispatchEvent(new Event('mask-hidden-complete'));
            }, 800);
        }, 200);
    }

    function init() {
        let count = 6;
        const timer = setInterval(() => {
            if (--count <= 0) {
                clearInterval(timer);
                hideMask();
            }
        }, 1000);

        if (document.readyState === 'complete') {
            hideMask();
        } else {
            window.addEventListener('load', () => {
                hideMask();
                clearInterval(timer);
            }, {once: true});
        }
    }

    window.OreUI_HideLoading = hideMask;
    window.OreUI_ShowLoading = showMask;
    init();
})();