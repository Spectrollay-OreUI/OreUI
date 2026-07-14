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

// --- 公共变量配置 ---
export const Repo_Name = 'oreui';
export const Root_Path = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
export const Current_URL = window.location.href;
export const Current_Page_Path = window.location.pathname;
export const Host_Path = window.location.origin;
export const isDevEnv = (
    Host_Path.includes('localhost:') ||
    Current_URL.startsWith('file:///') ||
    Current_Page_Path.startsWith('/test/')
);
export const Page_Level = (Current_Page_Path.split('/').filter(Boolean).length) - (Current_Page_Path.endsWith('.html') ? 1 : 0);
export const Relative_Offset = '../'.repeat(Page_Level);

/**
 * --- 日志管理器 ---
 */
export const logManager = {
    log: function (message, level = 'info') {
        const formattedMessage = `[${level.toUpperCase()}]: ${message}`;
        const logFunction = console[level] || console.log;

        if (level === 'error') {
            logFunction.call(console, formattedMessage);
            console.trace();
        } else if (isDevEnv) {
            logFunction.call(console, formattedMessage);
            console.trace();
        }
    }
};