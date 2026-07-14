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
 * @Component    : OreUI-Render
 * @Version      : 1.0.0
 * @Description  : OreUI 多功能代码高亮与交互式组件沙箱渲染引擎
 * ========================================================================== */

/** ==========================================================================
 * @Component    : oreui-code
 * @Description  : 基础行内代码组件
 * ========================================================================== */

import {copyText, playSound} from "@/javascript/public_script.js";
import {logManager} from "@/javascript/public_define.js";

class OreUI_Code extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const raw = this.textContent;
        this.textContent = raw.trim();
    }
}

if (!customElements.get('oreui-code')) {
    customElements.define('oreui-code', OreUI_Code);
}

/** ==========================================================================
 * @Component    : oreui-pre
 * @Description  : 格式化多语言代码块渲染及高级拖拽上下文状态机
 * ========================================================================== */

class OreUI_Pre extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const lang = (this.getAttribute('data-lang') || '').toLowerCase();
        const script = this.querySelector('script[type="text/plain"]');
        const template = this.querySelector('template');
        let rawCode = "";

        // 提取内部原始文本内容
        if (script) {
            rawCode = script.textContent;
        } else if (template) {
            rawCode = template.innerHTML;
            rawCode = rawCode.replace(/<(img|br|hr|input|meta|link)([^>]*?)\s*>/gi, (m, p1, p2) => {
                return p2.endsWith('/') ? m : `<${p1}${p2} />`;
            });
        } else {
            rawCode = this.textContent;
        }

        // 清理旧节点防止破坏 DOM 结构
        while (this.firstChild) {
            this.removeChild(this.firstChild);
        }

        // 规范化首尾无效换行
        rawCode = this.trimInitialIndent(rawCode);

        // 构建语言角标
        if (lang) {
            const badge = document.createElement('div');
            badge.className = 'lang-badge';
            badge.textContent = lang;
            this.appendChild(badge);
        }

        // 构建复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        this.updateButtonIcon(copyBtn, 'copy_white');
        this.appendChild(copyBtn);

        // 创建高亮代码容器
        const codeBlock = document.createElement('pre');
        codeBlock.className = 'pre-container';
        codeBlock.style.whiteSpace = 'pre';
        codeBlock.style.wordBreak = 'normal';
        codeBlock.style.wordWrap = 'normal';
        this.appendChild(codeBlock);

        // 执行核心解析逻辑
        this.highlightAuto(rawCode, lang, codeBlock);

        // 绑定复制按钮事件
        copyBtn.addEventListener('click', () => {
            playSound('click').catch(() => {
            });
            setTimeout(() => {
                this.copyCode(rawCode, copyBtn);
            }, 20);
        });

        let isDown = false;
        let startX;
        let startScrollLeft;

        // 监听容器尺寸变化并检测溢出状态
        const checkPreOverflow = () => {
            const hasOverflow = codeBlock.scrollWidth > codeBlock.clientWidth;
            if (hasOverflow) {
                codeBlock.classList.add('has-overflow');
            } else {
                codeBlock.classList.remove('has-overflow');
            }
        };

        const preResizeObserver = new ResizeObserver(() => checkPreOverflow());
        preResizeObserver.observe(codeBlock);
        setTimeout(checkPreOverflow, 50);

        // 绑定鼠标拖拽滚动事件
        codeBlock.addEventListener('mousedown', (e) => {
            if (e.target.closest('.copy-btn') || e.target.closest('.lang-badge')) return;
            if (codeBlock.scrollWidth <= codeBlock.clientWidth) return;

            e.preventDefault();
            isDown = true;
            codeBlock.classList.add('is-dragging');
            startX = e.clientX;
            startScrollLeft = codeBlock.scrollLeft;
        });

        codeBlock.addEventListener('mouseleave', () => {
            if (isDown) {
                isDown = false;
                codeBlock.classList.remove('is-dragging');
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDown) {
                isDown = false;
                codeBlock.classList.remove('is-dragging');
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const walk = (e.clientX - startX) * 1.5;
            codeBlock.scrollLeft = startScrollLeft - walk;
        });

        this._preObserver = preResizeObserver;
    }

    disconnectedCallback() {
        if (this._preObserver) this._preObserver.disconnect();
    }

    /**
     * 精准去除代码块产生的无效缩进与首尾空白行
     * @param {string} text - 待处理的原生多行代码
     * @returns {string} 清洗后的标准多行字符串
     */
    trimInitialIndent(text) {
        if (!text) return '';
        // 优化为单次正则替换 提升大文本处理性能
        return text.replace(/\r\n/g, '\n').replace(/^\s*[\n]/, '').replace(/[\n]\s*$/, '');
    }

    /**
     * 渐变切换按钮图标样式
     * @param {HTMLElement} btn - 目标按钮元素
     * @param {string} icon - 图片文件名
     */
    updateButtonIcon(btn, icon) {
        const oldImg = btn.querySelector('img');
        const iconUrl = new URL(`../assets/images/${icon}.png`, import.meta.url).href;

        if (!oldImg) {
            const img = document.createElement('img');
            img.src = iconUrl;
            img.alt = icon.includes('copy') ? 'Copy' : 'Copied';
            img.style.pointerEvents = 'none';
            btn.appendChild(img);
            return;
        }

        oldImg.classList.add('changing');

        // 使用双重动画帧确保过渡动画流畅
        requestAnimationFrame(() => {
            setTimeout(() => {
                oldImg.src = iconUrl;
                oldImg.alt = icon.includes('copy') ? 'Copy' : 'Copied';
                requestAnimationFrame(() => {
                    oldImg.classList.remove('changing');
                });
            }, 150);
        });
    }

    /**
     * 多语言代码核心高亮调度器
     * @param {string} text - 待解析的文本
     * @param {string} lang - 目标语言类型
     * @param {HTMLElement} container - 挂载节点的容器
     */
    highlightAuto(text, lang, container) {
        let masterRegex;
        const fragment = document.createDocumentFragment();
        let match;

        // 解析 JSON 语法
        if (lang === 'json') {
            masterRegex = /("[^"\\]*(?:\\.[^"\\]*)*"\s*)(?=:)|("[^"\\]*(?:\\.[^"\\]*)*")|(-?\b\d+(?:\.\d+)?\b)|(\b(?:true|false|null)\b)|([{}[\]])|([\s\S])/g;
            masterRegex.lastIndex = 0;

            while ((match = masterRegex.exec(text)) !== null) {
                if (match[0].length === 0) {
                    masterRegex.lastIndex++;
                    continue;
                }

                const [full, jsonKey, jsonValue, jsonNum, jsonBool, jsonBracket, rest] = match;

                if (jsonKey) fragment.appendChild(this.createSpan('token-property', jsonKey));
                else if (jsonValue) fragment.appendChild(this.createSpan('token-string', jsonValue));
                else if (jsonNum) fragment.appendChild(this.createSpan('token-number', jsonNum));
                else if (jsonBool) fragment.appendChild(this.createSpan('token-keyword', jsonBool));
                else if (jsonBracket) fragment.appendChild(document.createTextNode(jsonBracket));
                else if (rest) fragment.appendChild(document.createTextNode(rest));
            }
            container.appendChild(fragment);
            return;
        }

        // 解析 HTML 或者 XML 语法
        if (lang === 'html' || lang === 'xml') {
            let lastAttrName = '';
            let currentTagName = '';
            let isInsideTag = false;
            let expectAttrValue = false;

            masterRegex = /(<!--[\s\S]*?-->)|(<!DOCTYPE\b[^>]*>)|(<\/?[a-zA-Z0-9:_-]+)|(\b[a-zA-Z0-9:_-]+\s*=\s*)|("(?:\\.|[^"])*")|('(?:\\.|[^'])*')|(&[#a-zA-Z0-9:_-]+;)|(?<==\s*)([^\s"'=<>`\/]+)(?=\s|\/?>)|(\/>)|(>)|([\s\S])/gi;
            masterRegex.lastIndex = 0;

            while ((match = masterRegex.exec(text)) !== null) {
                if (match[0].length === 0) {
                    masterRegex.lastIndex++;
                    continue;
                }

                const [full, comment, doctype, tagName, attrNameAndEq, dQuoteStr, sQuoteStr, entity, unquotedAttrValue, selfClose, normalClose, rest] = match;

                if (comment) {
                    fragment.appendChild(this.createSpan('token-comment', comment));
                } else if (doctype) {
                    let lastIndex = 0;
                    doctype.replace(/(<!DOCTYPE)|(\bPUBLIC\b|\bSYSTEM\b)|("[^"]*")|(>)/gi, (m, decl, keyword, str, close, offset) => {
                        if (offset > lastIndex) fragment.appendChild(document.createTextNode(doctype.slice(lastIndex, offset)));
                        if (decl) fragment.appendChild(this.createSpan('token-tag', decl));
                        else if (keyword) fragment.appendChild(this.createSpan('token-tag', keyword));
                        else if (str) fragment.appendChild(this.createSpan('token-string', str));
                        else if (close) fragment.appendChild(this.createSpan('token-tag', close));
                        lastIndex = offset + m.length;
                    });
                    if (lastIndex < doctype.length) fragment.appendChild(document.createTextNode(doctype.slice(lastIndex)));
                } else if (tagName) {
                    isInsideTag = true;
                    currentTagName = tagName.replace(/[</>]/g, '').toLowerCase();
                    fragment.appendChild(this.createSpan('token-tag', tagName));
                } else if (attrNameAndEq) {
                    const eqIndex = attrNameAndEq.indexOf('=');
                    const attrName = attrNameAndEq.slice(0, eqIndex);
                    const eqPart = attrNameAndEq.slice(eqIndex);
                    lastAttrName = attrName.trim().toLowerCase();
                    expectAttrValue = true;
                    fragment.appendChild(document.createTextNode(attrName));
                    fragment.appendChild(document.createTextNode(eqPart));
                } else if (dQuoteStr || sQuoteStr) {
                    const strValueWithQuotes = dQuoteStr || sQuoteStr;
                    const quote = strValueWithQuotes[0];
                    const attrValue = strValueWithQuotes.slice(1, -1);
                    expectAttrValue = false;
                    fragment.appendChild(this.createSpan('token-string', quote));

                    const embeddedContainer = document.createElement('span');
                    if (lastAttrName === 'style') this.highlightAuto(attrValue, 'css_inner_inject', embeddedContainer);
                    else if (lastAttrName.startsWith('on')) this.highlightAuto(attrValue, 'js_inner', embeddedContainer);
                    else embeddedContainer.appendChild(this.createSpan('token-string', attrValue));

                    while (embeddedContainer.firstChild) fragment.appendChild(embeddedContainer.firstChild);
                    fragment.appendChild(this.createSpan('token-string', quote));
                    lastAttrName = '';
                } else if (unquotedAttrValue) {
                    if (isInsideTag && expectAttrValue) {
                        fragment.appendChild(this.createSpan('token-string', unquotedAttrValue));
                        expectAttrValue = false;
                    } else {
                        fragment.appendChild(document.createTextNode(unquotedAttrValue));
                    }
                } else if (entity) {
                    fragment.appendChild(this.createSpan('token-entity', entity));
                } else if (selfClose) {
                    fragment.appendChild(this.createSpan('token-tag', selfClose));
                    lastAttrName = '';
                    currentTagName = '';
                    expectAttrValue = false;
                    isInsideTag = false;
                } else if (normalClose) {
                    fragment.appendChild(this.createSpan('token-tag', normalClose));
                    lastAttrName = '';
                    expectAttrValue = false;
                    isInsideTag = false;
                } else if (rest) {
                    fragment.appendChild(document.createTextNode(rest));
                }
            }
            container.appendChild(fragment);
            return;
        }

        // 解析 CSS 样式
        if (lang === 'css' || lang === 'css_inner_inject') {
            let braceStack = (lang === 'css_inner_inject') ? 1 : 0;
            let mediaStack = 0;
            let isPropertyValueZone = false;

            masterRegex = /(\/\*[\s\S]*?\*\/)|(@[a-zA-Z-]+)|(("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*'))|(\b(?:url|calc|var|rgb|rgba|hsl|hsla|attr)(?=\s*\(\s*\)))|((?<=\burl\s*\(\s*)[^)'"]+)|(\bU\+[0-9a-fA-F-]+(?:-[0-9a-fA-F-]+)?\b)|(#[0-9a-fA-F]{3,8}\b)|(!important\b)|(\b\d+(?:\.\d+)?)(px|em|rem|%|s|ms|deg|vh|vw\b)?|([-a-zA-Z0-9_]+)(\s*:)?|([\s\S])/g;
            masterRegex.lastIndex = 0;

            while ((match = masterRegex.exec(text)) !== null) {
                if (match[0].length === 0) {
                    masterRegex.lastIndex++;
                    continue;
                }

                const [full, comment, atRule, string, dStr, sStr, cssFunc, urlValue, unicodeRange, hexColor, important, num, unit, word, hasColon, rest] = match;

                if (comment) {
                    fragment.appendChild(this.createSpan('token-comment', comment));
                } else if (atRule) {
                    fragment.appendChild(this.createSpan('token-keyword', atRule));
                    if (atRule.toLowerCase() === '@media') mediaStack = 1;
                } else if (string) {
                    fragment.appendChild(this.createSpan('token-string', string));
                } else if (cssFunc) {
                    fragment.appendChild(this.createSpan('token-tag', cssFunc));
                } else if (urlValue) {
                    fragment.appendChild(this.createSpan('token-url-path', urlValue));
                } else if (unicodeRange) {
                    fragment.appendChild(this.createSpan('token-tag', unicodeRange));
                } else if (hexColor) {
                    fragment.appendChild(this.createSpan('token-number', hexColor));
                } else if (important) {
                    fragment.appendChild(this.createSpan('token-keyword', important));
                } else if (num) {
                    fragment.appendChild(this.createSpan('token-pure-number', num));
                    if (unit) {
                        fragment.appendChild(unit === '%' ? document.createTextNode(unit) : this.createSpan('token-string', unit));
                    }
                } else if (word) {
                    const lowerWord = word.toLowerCase();
                    const leftText = text.substring(0, match.index).trim();
                    const prevChar = leftText[leftText.length - 1];

                    if (braceStack === 0 || (mediaStack === 1 && braceStack === 1)) {
                        if (lowerWord === 'screen' || lowerWord === 'max-width' || lowerWord === 'orientation') {
                            fragment.appendChild(document.createTextNode(word));
                        } else if (mediaStack === 1 && prevChar === ':' && !hasColon && !['root', 'after', 'before', 'hover', 'lang', 'active', 'focus'].includes(lowerWord)) {
                            fragment.appendChild(this.createSpan('token-string', word));
                        } else {
                            fragment.appendChild(this.createSpan('token-tag', word));
                        }
                        if (hasColon) fragment.appendChild(document.createTextNode(hasColon));
                    } else {
                        if (hasColon) {
                            fragment.appendChild(document.createTextNode(word + hasColon));
                            isPropertyValueZone = true;
                        } else {
                            if (['var', 'calc', 'url', 'rgb', 'rgba', 'hsl', 'hsla', 'attr'].includes(lowerWord)) {
                                fragment.appendChild(this.createSpan('token-tag', word));
                            } else if (word.startsWith('--') || lowerWord === 'and') {
                                fragment.appendChild(this.createSpan('token-tag', word));
                            } else if (isPropertyValueZone) {
                                fragment.appendChild(word === '-' ? document.createTextNode(word) : this.createSpan('token-string', word));
                            } else {
                                fragment.appendChild(prevChar === ':' && !isPropertyValueZone ? this.createSpan('token-tag', word) : document.createTextNode(word));
                            }
                        }
                    }
                } else if (rest) {
                    if (rest === '{') {
                        braceStack++;
                        isPropertyValueZone = false;
                    } else if (rest === '}') {
                        braceStack = Math.max(0, braceStack - 1);
                        isPropertyValueZone = false;
                        if (braceStack === 0) mediaStack = 0;
                    } else if (rest === ';') {
                        isPropertyValueZone = false;
                    }

                    const isInSelectorContext = (braceStack === 0 || (mediaStack === 1 && braceStack === 1) || !isPropertyValueZone);
                    if ((rest === '#' || rest === '&' || rest === '*') && isInSelectorContext) {
                        fragment.appendChild(this.createSpan('token-tag', rest));
                    } else {
                        fragment.appendChild(document.createTextNode(rest));
                    }
                }
            }
            container.appendChild(fragment);
            return;
        }

        // 解析 JavaScript 及 TypeScript 语法
        if (lang === 'js' || lang === 'javascript' || lang === 'js_inner' || lang === 'ts' || lang === 'typescript') {
            const jsKeywords = new Set(['const', 'let', 'var', 'function', 'return', 'import', 'export', 'default', 'class', 'extends', 'if', 'else', 'switch', 'case', 'break', 'continue', 'for', 'while', 'do', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'typeof', 'instanceof', 'void', 'in', 'of', 'true', 'false', 'null', 'undefined', 'this', 'super', 'async', 'await', 'static', 'get', 'set', 'yield']);
            masterRegex = /(\/\*\*[\s\S]*?\*\/)|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[\s\S])*?`)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\/(?![\/*])(?:\\.|[^\/\n])+\/[gimuyds]*)|(\b\d+(?:\.\d+)?\b)|(@[a-zA-Z_$][\w$]*)|(#[a-zA-Z_$][\w$]*)|([A-Z][A-Z0-9_]{2,})|([A-Z][a-zA-Z0-9_$]*)|([a-zA-Z_$][\w$]*)|(\?\?|\?\.|=>|===|!==|==|!=|>=|<=|&&|\|\||\/>)|([(){}\[\]])|([.:,;<>])|([=+\-*\/%!&|^~])|(\s+)|([\s\S])/g;
            const tokens = [];

            while ((match = masterRegex.exec(text)) !== null) {
                if (match[0].length === 0) {
                    masterRegex.lastIndex++;
                    continue;
                }

                const [full, doc, comm, tpl, str, regex, num, decorator, privateField, upperConst, upperIdent, ident, complexOp, bracket, punctuation, operator, whitespace, invalid] = match;

                if (doc) tokens.push({type: 'doc-comment', value: doc});
                else if (comm) tokens.push({type: 'comment', value: comm});
                else if (tpl) tokens.push({type: 'template', value: tpl});
                else if (str) tokens.push({type: 'string', value: str});
                else if (regex) tokens.push({type: 'regex', value: regex});
                else if (num) tokens.push({type: 'number', value: num});
                else if (decorator) tokens.push({type: 'decorator', value: decorator});
                else if (privateField) tokens.push({type: 'private-field', value: privateField});
                else if (upperConst) tokens.push({type: 'upper-const', value: upperConst});
                else if (upperIdent) tokens.push({type: 'upper-identifier', value: upperIdent});
                else if (ident) tokens.push({type: jsKeywords.has(ident) ? 'keyword' : 'identifier', value: ident});
                else if (complexOp) tokens.push({type: 'operator', value: complexOp});
                else if (bracket) tokens.push({type: 'bracket', value: bracket});
                else if (punctuation) tokens.push({type: 'punctuation', value: punctuation});
                else if (operator) tokens.push({type: 'operator', value: operator});
                else if (whitespace) tokens.push({type: 'whitespace', value: whitespace});
                else if (invalid) tokens.push({type: 'invalid', value: invalid});
            }

            let inClass = false;
            let classBraceDepth = 0;
            let inJsxTag = false;

            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                const prev = this.getPreviousNonWhitespaceToken(tokens, i);
                const next = this.getNextNonWhitespaceToken(tokens, i);

                if (token.type === 'keyword' && token.value === 'class') {
                    inClass = true;
                }
                if (inClass && token.type === 'bracket') {
                    if (token.value === '{') {
                        classBraceDepth++;
                    } else if (token.value === '}') {
                        classBraceDepth = Math.max(0, classBraceDepth - 1);
                        if (classBraceDepth === 0) inClass = false;
                    }
                }

                if (token.type === 'punctuation' && token.value === '<' && next && (next.type === 'identifier' || next.type === 'upper-identifier' || next.value === '/')) {
                    inJsxTag = true;
                    fragment.appendChild(this.createSpan('token-tag', token.value));
                    continue;
                }
                if (inJsxTag && ((token.type === 'punctuation' && token.value === '>') || (token.type === 'operator' && token.value === '/>'))) {
                    inJsxTag = false;
                    fragment.appendChild(this.createSpan('token-tag', token.value));
                    continue;
                }

                if (inJsxTag) {
                    if (token.type === 'identifier' || token.type === 'upper-identifier') {
                        if (prev && (prev.value === '<' || prev.value === '/')) {
                            fragment.appendChild(this.createSpan('token-tag', token.value));
                        } else {
                            fragment.appendChild(document.createTextNode(token.value));
                        }
                    } else if (token.type === 'string') {
                        fragment.appendChild(this.createSpan('token-string', token.value));
                    } else {
                        fragment.appendChild(document.createTextNode(token.value));
                    }
                    continue;
                }

                if (token.type === 'doc-comment') {
                    fragment.appendChild(this.createSpan('token-doc-comment', token.value));
                } else if (token.type === 'comment') {
                    fragment.appendChild(this.createSpan('token-comment', token.value));
                } else if (token.type === 'template') {
                    this.parseAdvancedTemplateString(token.value, fragment);
                } else if (token.type === 'string') {
                    this.parseJSString(token.value, fragment);
                } else if (token.type === 'regex') {
                    fragment.appendChild(this.createSpan('token-regex', token.value));
                } else if (token.type === 'number') {
                    fragment.appendChild(this.createSpan('token-pure-number', token.value));
                } else if (token.type === 'decorator') {
                    fragment.appendChild(this.createSpan('token-decorator', token.value));
                } else if (token.type === 'private-field') {
                    fragment.appendChild(this.createSpan('token-property', token.value));
                } else if (token.type === 'keyword') {
                    fragment.appendChild(this.createSpan('token-keyword', token.value));
                } else if (token.type === 'upper-const') {
                    let prev2 = null;
                    let nonSpaceCount = 0;
                    for (let k = i - 1; k >= 0; k--) {
                        if (tokens[k].type !== 'whitespace') {
                            nonSpaceCount++;
                            if (nonSpaceCount === 2) {
                                prev2 = tokens[k];
                                break;
                            }
                        }
                    }

                    if (prev && prev.value === 'const' && prev2 && prev2.value === 'export') {
                        fragment.appendChild(this.createSpan('token-property', token.value));
                    } else if (prev && prev.value === 'static') {
                        fragment.appendChild(this.createSpan('token-property', token.value));
                    } else {
                        fragment.appendChild(document.createTextNode(token.value));
                    }
                } else if (token.type === 'upper-identifier') {
                    if (prev && prev.value === '<') {
                        fragment.appendChild(this.createSpan('token-class', token.value));
                    } else if (prev && prev.type === 'keyword' && prev.value === 'static') {
                        fragment.appendChild(this.createSpan('token-property', token.value));
                    } else if (next && next.value === '.') {
                        fragment.appendChild(this.createSpan('token-property', token.value));
                    } else if (next && next.value === '(') {
                        fragment.appendChild(this.createSpan('token-function', token.value));
                    } else {
                        fragment.appendChild(document.createTextNode(token.value));
                    }
                } else if (token.type === 'identifier') {
                    if (token.value === 'constructor') {
                        fragment.appendChild(this.createSpan('token-keyword', token.value));
                    } else if (next && next.value === ':') {
                        fragment.appendChild(this.createSpan('token-property', token.value));
                    } else if (prev && (prev.value === '.' || prev.value === '?.')) {
                        fragment.appendChild(this.createSpan(next && next.value === '(' ? 'token-function' : 'token-property', token.value));
                    } else if (next && next.value === '.') {
                        fragment.appendChild(this.createSpan('token-property', token.value));
                    } else if (next && next.value === '(') {
                        fragment.appendChild(this.createSpan('token-function', token.value));
                    } else if (next && next.value === '=') {
                        const remaining = tokens.slice(i + 1, i + 10).map(t => t.value).join('');
                        if (remaining.includes('=>')) {
                            fragment.appendChild(this.createSpan('token-function', token.value));
                        } else if (inClass && classBraceDepth === 1 && !(prev && prev.value === '(')) {
                            fragment.appendChild(this.createSpan('token-property', token.value));
                        } else {
                            fragment.appendChild(document.createTextNode(token.value));
                        }
                    } else {
                        fragment.appendChild(document.createTextNode(token.value));
                    }
                } else if (token.type === 'invalid') {
                    fragment.appendChild(this.createSpan('token-invalid', token.value));
                } else {
                    fragment.appendChild(document.createTextNode(token.value));
                }
            }

            container.appendChild(fragment);
            return;
        }

        fragment.appendChild(document.createTextNode(text));
        container.appendChild(fragment);
    }

    /**
     * 解析普通 JavaScript 字符串中的转义字符
     * @param {string} str - 待处理字符串
     * @param {DocumentFragment} parentFragment - 父级文档片段
     */
    parseJSString(str, parentFragment) {
        const quote = str[0];
        parentFragment.appendChild(this.createSpan('token-string', quote));

        const inner = str.slice(1, -1);
        const escapeRegex = /(\\u{[a-fA-F0-9]{1,6}}|\\u[a-fA-F0-9]{1,4}|\\x[a-fA-F0-9]{1,2}|\\.)/g;
        let lastIndex = 0;
        let match;

        while ((match = escapeRegex.exec(inner)) !== null) {
            if (match[0].length === 0) {
                escapeRegex.lastIndex++;
                continue;
            }
            const preceding = inner.slice(lastIndex, match.index);
            if (preceding) {
                parentFragment.appendChild(this.createSpan('token-string', preceding));
            }
            parentFragment.appendChild(this.createSpan('token-keyword', match[1]));
            lastIndex = escapeRegex.lastIndex;
        }

        const remaining = inner.slice(lastIndex);
        if (remaining) {
            parentFragment.appendChild(this.createSpan('token-string', remaining));
        }
        parentFragment.appendChild(this.createSpan('token-string', quote));
    }

    /**
     * 解析模板字符串及内部插值表达式
     * @param {string} str - 模板字符串文本
     * @param {DocumentFragment} parentFragment - 父级文档片段
     */
    parseAdvancedTemplateString(str, parentFragment) {
        parentFragment.appendChild(this.createSpan('token-string', '`'));

        const inner = str.slice(1, -1);
        const interpRegex = /(\${[\s\S]*?})/g;
        let lastIndex = 0;
        let match;

        while ((match = interpRegex.exec(inner)) !== null) {
            if (match[0].length === 0) {
                interpRegex.lastIndex++;
                continue;
            }
            const preceding = inner.slice(lastIndex, match.index);

            if (preceding.includes('<') && preceding.includes('>')) {
                const htmlContainer = document.createElement('span');
                this.highlightAuto(preceding, 'html', htmlContainer);
                while (htmlContainer.firstChild) {
                    parentFragment.appendChild(htmlContainer.firstChild);
                }
            } else {
                parentFragment.appendChild(this.createSpan('token-string', preceding));
            }

            parentFragment.appendChild(document.createTextNode('${'));
            const innerCode = match[1].slice(2, -1);
            const jsContainer = document.createElement('span');

            this.highlightAuto(innerCode, 'js_inner', jsContainer);
            while (jsContainer.firstChild) {
                parentFragment.appendChild(jsContainer.firstChild);
            }

            parentFragment.appendChild(document.createTextNode('}'));
            lastIndex = interpRegex.lastIndex;
        }

        const remaining = inner.slice(lastIndex);
        if (remaining) {
            parentFragment.appendChild(this.createSpan('token-string', remaining));
        }
        parentFragment.appendChild(this.createSpan('token-string', '`'));
    }

    /**
     * 获取前一个非空词法单元
     * @param {Array} tokens - 词法单元列表
     * @param {number} index - 当前位置索引
     * @returns {Object|null}
     */
    getPreviousNonWhitespaceToken(tokens, index) {
        for (let i = index - 1; i >= 0; i--) {
            if (tokens[i].type !== 'whitespace') return tokens[i];
        }
        return null;
    }

    /**
     * 获取后一个非空词法单元
     * @param {Array} tokens - 词法单元列表
     * @param {number} index - 当前位置索引
     * @returns {Object|null}
     */
    getNextNonWhitespaceToken(tokens, index) {
        for (let i = index + 1; i < tokens.length; i++) {
            if (tokens[i].type !== 'whitespace') return tokens[i];
        }
        return null;
    }

    /**
     * 便捷创建高亮文本节点包装器
     * @param {string} className - 样式类名
     * @param {string} text - 节点文本
     * @returns {HTMLSpanElement}
     */
    createSpan(className, text) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        return span;
    }

    /**
     * 执行代码异步复制及状态复位
     * @param {string} rawCode - 待复制文本
     * @param {HTMLElement} copyBtn - 复制按钮实例
     */
    copyCode(rawCode, copyBtn) {
        copyBtn.classList.add('copied');
        this.updateButtonIcon(copyBtn, 'check_white');
        copyBtn.style.pointerEvents = 'none';

        const copyPromise = copyText(rawCode, 'code');

        copyPromise.then((isSuccess) => {
            if (!isSuccess) {
                copyBtn.classList.remove('copied');
                copyBtn.classList.add('copied-error');
                this.updateButtonIcon(copyBtn, 'cross_white');
            }
        });

        setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.classList.remove('copied-error');
            this.updateButtonIcon(copyBtn, 'copy_white');
            setTimeout(() => {
                copyBtn.style.pointerEvents = 'auto';
                logManager.log("代码块复制按钮动效复位成功并解锁交互");
            }, 150);
        }, 1500);
    }
}

if (!customElements.get('oreui-pre')) {
    customElements.define('oreui-pre', OreUI_Pre);
}

/** ==========================================================================
 * @Component    : oreui-display
 * @Description  : 交互式独立沙箱组件预览与全屏分流渲染器
 * ========================================================================== */

// 核心模板预设
const TEMPLATE_PRESETS = {
    // 空白模板
    blank: {
        showFullscreenToggle: true, // 全屏状态下显示右上角悬浮切换按钮
        templates: [
            (content) => `${content}`
        ]
    },

    // 2. 基础模板 (现有的经典样式)
    base: {
        showFullscreenToggle: false, // 全屏状态下不显示右上角悬浮切换按钮
        templates: [
            // 非全屏模式下的结构
            (content) => `
                <oreui-display-area>
                    <oreui-display-body>
                        <main class="scroll_container">${content}</main>
                    </oreui-display-body>
                </oreui-display-area>
                <style>
                    html, body, oreui-display-area, oreui-display-body {
                        box-sizing: border-box;
                        height: auto;
                        min-height: 98px;
                    }
                
                    html, body, oreui-loading-mask {
                        background-color: #1e1e24;
                    }
                    
                    .scroll_container {
                        align-items: center;
                        box-sizing: border-box;
                        display: flex;
                        padding: 12px;
                    }
                </style>
            `,
            // 全屏模式下的结构
            (content) => `
                <oreui-display-area>
                    <oreui-header>
                        <oreui-header-left>
                            <oreui-header-item class="header_item_left header_item_blank"></oreui-header-item>
                        </oreui-header-left>
                        <oreui-header-logo>
                            <oreui-header-title>组件预览</oreui-header-title>
                        </oreui-header-logo>
                        <oreui-header-right>
                            <oreui-header-item class="header_item_right" data-event="toggleFullscreen" style="cursor: pointer;">
                                <img alt="" class="header_right_icon full_screen_icon" src="/src/assets/images/fullScreen.png"/>
                            </oreui-header-item>
                        </oreui-header-right>
                    </oreui-header>
                    <oreui-display-body>
                        <oreui-scroll-view class="main_scroll_view">
                            <oreui-scroll-container class="primary_scroll_container">
                                <main class="scroll_container">${content}</main>
                            </oreui-scroll-container>
                            <oreui-scrollbar class="primary_oreui_scrollbar">
                                <oreui-scrollbar-track></oreui-scrollbar-track>
                                <oreui-scrollbar-thumb></oreui-scrollbar-thumb>
                            </oreui-scrollbar>
                        </oreui-scroll-view>
                    </oreui-display-body>
                </oreui-display-area>
                <style>
                    oreui-display-area {
                        background: #48494A;
                        display: block;
                        min-height: 100vh;
                    }
                    
                    #full_screen_icon {
                        height: 26px;
                        padding: 6px 6px 6px 8px;
                    }
                </style>
            `
        ]
    },

    // 自定义模板
    custom: {
        showFullscreenToggle: true, // 全屏时是否显示悬浮切换按钮
        templates: [
            // 如果全屏与非全屏一致, 只保留这一个函数即可
            (content) => `<div class="custom-normal-wrap">${content}</div>`,

            // 如果全屏与非全屏不一致, 取消下方注释并编写全屏模板
            /*
            (content) => `<div class="custom-fullscreen-wrap">${content}</div>`
            */
        ]
    }
};

class OreUI_Display extends HTMLElement {
    constructor() {
        super();
        this.handleEsc = this.handleEsc.bind(this);
        this._iframeResizeObserver = null;
        this._animatingDirection = null;
        this._loadingTimeoutTimer = null;
    }

    connectedCallback() {
        const template = this.querySelector('template');
        this.previewContent = template ? template.innerHTML : this.innerHTML;
        if (template) template.remove();

        // 创建 iframe 沙箱核心
        this.iframe = document.createElement('iframe');
        this.iframe.className = 'preview-interactive-iframe';
        this.appendChild(this.iframe);

        // 创建宿主右上角控制全屏切换按钮
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.className = 'fullscreen-toggle';
        this.toggleBtn.type = 'button';

        const toggleImg = document.createElement('img');
        toggleImg.src = new URL('../assets/images/fullScreen.png', import.meta.url).href;
        toggleImg.style.pointerEvents = 'none';
        this.toggleBtn.appendChild(toggleImg);

        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFullscreen().then();
        });
        this.appendChild(this.toggleBtn);

        // 初始化配置应用
        this.applyDisplayConfig();

        this.iframe.onload = () => {
            // 只要加载完成就立即清除超时定时器
            this.clearLoadingTimeout();

            const isFullscreen = this.classList.contains('is-fullscreen');
            const iframeWin = this.iframe.contentWindow;
            const iframeDoc = this.iframe.contentDocument;
            const srcAttr = this.getAttribute('data-src');

            if (isFullscreen) {
                try {
                    iframeWin.removeEventListener('keydown', this.handleEsc);
                    iframeWin.addEventListener('keydown', this.handleEsc);

                    const innerCloseBtn = iframeDoc.querySelector('[data-event="toggleFullscreen"]');
                    if (innerCloseBtn) {
                        innerCloseBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.toggleFullscreen().then();
                        });
                    }
                } catch (err) {
                    logManager.log("全屏跨边界事件绑定失败!", 'error');
                } finally {
                    this.updateFullscreenToggleVisibility();
                    if (window.OreUI_HideLoading) window.OreUI_HideLoading();
                    this._animatingDirection = null;
                }
                return;
            }

            // 处理嵌入模式 (非全屏)
            try {
                if (srcAttr) {
                    this.style.removeProperty('--iframe-dynamic-height');
                    return;
                }

                iframeWin.addEventListener('wheel', (e) => {
                    if (this.classList.contains('is-fullscreen')) return;

                    const mainContainer = document.querySelector('.primary_scroll_container');
                    if (!mainContainer) return;

                    mainContainer.scrollTop += e.deltaY;

                    if (typeof window.getMainHandleScroll === 'function') {
                        window.getMainHandleScroll()();
                    }

                    e.preventDefault();
                }, {passive: false});

                this.initIframeAutoHeight(iframeDoc);

            } catch (err) {
                logManager.log(`OreUI 运行期环境注入失败` + err, 'error');
            } finally {
                if (window.OreUI_HideLoading) window.OreUI_HideLoading();
                this._animatingDirection = null;
            }
        };
    }

    /**
     * 开启超时兜底定时器
     * @param {number} ms - 超时时间
     */
    startLoadingTimeout(ms = 6000) {
        this.clearLoadingTimeout();
        this._loadingTimeoutTimer = setTimeout(() => {
            logManager.log(`[OreUI-Display] Iframe 加载超时(${ms}ms)或被浏览器安全拦截, 强制关闭遮罩.`, 'warn');
            if (window.OreUI_HideLoading) window.OreUI_HideLoading();
            this._animatingDirection = null;
        }, ms);
    }

    /**
     * 清除超时定时器
     */
    clearLoadingTimeout() {
        if (this._loadingTimeoutTimer) {
            clearTimeout(this._loadingTimeoutTimer);
            this._loadingTimeoutTimer = null;
        }
    }

    /**
     * 读取 HTML 属性定义并决策渲染控制流
     */
    applyDisplayConfig() {
        const srcAttr = this.getAttribute('data-src');
        const showToggleAttr = this.getAttribute('show-toggle') !== 'false';

        if (srcAttr) {
            this.toggleBtn.style.display = 'flex';
            this.classList.add('is-web-link');

            // 在线网页3s超时安全兜底
            this.startLoadingTimeout(3000);
            this.iframe.src = srcAttr;
        } else {
            this.classList.remove('is-web-link');
            this.toggleBtn.style.display = showToggleAttr ? 'flex' : 'none';
            this.renderTemplate(false); // 渲染非全屏模板
        }
    }

    /**
     * 核心路由渲染
     */
    renderTemplate(isFullscreen) {
        const mode = this.getAttribute('template-mode') || 'base';
        const config = TEMPLATE_PRESETS[mode] || TEMPLATE_PRESETS['base'];

        let targetTemplateFunc;
        if (isFullscreen) {
            targetTemplateFunc = config.templates[1] || config.templates[0];
        } else {
            targetTemplateFunc = config.templates[0];
        }

        const renderedBody = targetTemplateFunc(this.previewContent);

        // 本地模板渲染0.6s超时安全兜底
        this.startLoadingTimeout(600);
        this.iframe.srcdoc = this.wrapBaseLayout(renderedBody);
    }

    /**
     * 全屏状态下悬浮按钮显隐精准控制
     */
    updateFullscreenToggleVisibility() {
        const srcAttr = this.getAttribute('data-src');
        if (srcAttr) {
            this.toggleBtn.style.display = 'flex';
            return;
        }

        const mode = this.getAttribute('template-mode') || 'base';
        const config = TEMPLATE_PRESETS[mode] || TEMPLATE_PRESETS['base'];

        this.toggleBtn.style.display = config.showFullscreenToggle ? 'flex' : 'none';
    }

    initIframeAutoHeight(iframeDoc) {
        if (this._iframeResizeObserver) {
            this._iframeResizeObserver.disconnect();
        }

        const rootElement = iframeDoc.documentElement;
        if (!rootElement) return;

        this._iframeResizeObserver = new ResizeObserver((entries) => {
            if (this.classList.contains('is-fullscreen')) return;

            for (let entry of entries) {
                let contentHeight = 0;

                if (entry.borderBoxSize && entry.borderBoxSize[0]) {
                    contentHeight = entry.borderBoxSize[0].blockSize;
                } else {
                    contentHeight = rootElement.scrollHeight;
                }

                if (contentHeight === 0) continue;

                requestAnimationFrame(() => {
                    if (this.classList.contains('is-fullscreen')) return;

                    this.style.setProperty('--iframe-dynamic-height', `${contentHeight + 2}px`);

                    if (typeof window.getMainHandleScroll === 'function') {
                        window.getMainHandleScroll()();
                    }
                });
            }
        });

        this._iframeResizeObserver.observe(rootElement);
    }

    wrapBaseLayout(innerContent) {
        return `
            <!DOCTYPE html>
            <html lang="zh">
            <head>
                <meta charset="UTF-8">
                <meta content="IE=edge,chrome=1" http-equiv="X-UA-Compatible">
                <meta content="webkit" name="renderer">
                <meta content="width=device-width, initial-scale=1.0" name="viewport">
                <link href="/src/components/layout/loading/style.css" rel="stylesheet">
            </head>
            <oreui-loading-mask>
                <oreui-loading-wrapper>
                    <oreui-loading-spinner>
                        <img alt="Loading" class="spinner_img" src="/src/assets/images/Loading_white.gif"/>
                    </oreui-loading-spinner>
                    <oreui-loading-spinner>
                        <span class="spinner_text">加载中</span>
                    </oreui-loading-spinner>
                </oreui-loading-wrapper>
            </oreui-loading-mask>
            <body>
                ${innerContent}
            </body>
            <script type="module" src="/src/index.js"></script>
            </html>
        `;
    }

    async toggleFullscreen() {
        if (this._animatingDirection !== null) return;

        const willBeFullscreen = !this.classList.contains('is-fullscreen');
        this._animatingDirection = willBeFullscreen ? 'entering' : 'exiting';

        await playSound('click').catch(() => {});

        if (typeof window.OreUI_ShowLoading === 'function') {
            window.OreUI_ShowLoading('#48494a');
        }

        setTimeout(() => {
            const srcAttr = this.getAttribute('data-src');

            if (willBeFullscreen) {
                if (this._iframeResizeObserver) this._iframeResizeObserver.disconnect();

                document.removeEventListener('keydown', this.handleEsc);
                document.addEventListener('keydown', this.handleEsc);

                this.classList.add('is-fullscreen');

                if (srcAttr) {
                    // 全屏切换切换在线网址,重置兜底定时器
                    this.startLoadingTimeout(3000);
                } else {
                    this.renderTemplate(true); // 渲染全屏模板
                }
            } else {
                document.removeEventListener('keydown', this.handleEsc);
                this.classList.remove('is-fullscreen');

                const showToggleAttr = this.getAttribute('show-toggle') !== 'false';
                this.toggleBtn.style.display = showToggleAttr ? 'flex' : 'none';

                if (srcAttr) {
                    // 退出全屏切换在线网址,重置兜底定时器
                    this.startLoadingTimeout(3000);
                } else {
                    this.renderTemplate(false); // 还原非全屏模板
                }
            }
        }, 200);
    }

    handleEsc(e) {
        if (e.key === 'Escape') {
            if (this._animatingDirection !== null) return;
            if (!this.classList.contains('is-fullscreen')) return;

            setTimeout(() => {
                this.toggleFullscreen().then();
            }, 500);
        }
    }

    disconnectedCallback() {
        this.clearLoadingTimeout();
        document.removeEventListener('keydown', this.handleEsc);
        if (this._iframeResizeObserver) this._iframeResizeObserver.disconnect();
    }
}

customElements.define('oreui-display', OreUI_Display);
