import DefaultTheme from 'vitepress/theme'
import {nextTick, onMounted, onUnmounted, watch} from 'vue'
import {useRoute} from 'vitepress'
import './custom.css'

export default {
    extends: DefaultTheme,
    setup() {
        const route = useRoute()

        let activeObserver = null
        let hashHandler = null
        let clickHandler = null
        let docMutationObserver = null

        const cleanup = () => {
            if (activeObserver) {
                activeObserver.disconnect()
                activeObserver = null
            }
            if (docMutationObserver) {
                docMutationObserver.disconnect()
                docMutationObserver = null
            }
            if (hashHandler) {
                window.removeEventListener('hashchange', hashHandler)
                hashHandler = null
            }
            if (clickHandler) {
                document.removeEventListener('click', clickHandler, true)
                clickHandler = null
            }
            document.querySelectorAll('#changelog-sentinel').forEach(el => el.remove())
        }

        const initChangelogPagination = () => {
            if (typeof window === 'undefined') return
            cleanup()

            const PAGE_SIZE = 20
            const BUFFER_THRESHOLD = 3
            let currentVisibleCount = PAGE_SIZE

            const versionItems = Array.from(document.querySelectorAll('.vp-doc .changelog-item'))
            if (!versionItems.length) return

            const updateTriggerObserver = () => {
                if (activeObserver) {
                    activeObserver.disconnect()
                }

                if (currentVisibleCount >= versionItems.length) return

                const triggerIndex = currentVisibleCount - 1 - (BUFFER_THRESHOLD - 1)
                const triggerElement = versionItems[Math.max(0, triggerIndex)]

                if (triggerElement) {
                    activeObserver = new IntersectionObserver((entries) => {
                        if (entries[0].isIntersecting) {
                            loadMore()
                        }
                    }, {rootMargin: '50px'})

                    activeObserver.observe(triggerElement)
                }
            }

            const updateVisibility = (targetCount) => {
                versionItems.forEach((item, index) => {
                    item.style.display = index < targetCount ? '' : 'none'
                })

                const sentinel = document.getElementById('changelog-sentinel')
                if (sentinel) {
                    sentinel.style.display = targetCount >= versionItems.length ? 'none' : 'block'
                }

                updateTriggerObserver()
            }

            const loadMore = () => {
                if (currentVisibleCount >= versionItems.length) return
                currentVisibleCount += PAGE_SIZE
                updateVisibility(currentVisibleCount)
            }

            const container = document.querySelector('.vp-doc')
            if (container && !document.getElementById('changelog-sentinel')) {
                const sentinelContainer = document.createElement('div')
                sentinelContainer.id = 'changelog-sentinel'
                sentinelContainer.className = 'v-load-more-container'

                const loadMoreBtn = document.createElement('button')
                loadMoreBtn.className = 'v-load-more-btn'
                loadMoreBtn.textContent = '加载更多...'
                loadMoreBtn.type = 'button'

                loadMoreBtn.addEventListener('click', loadMore)
                sentinelContainer.appendChild(loadMoreBtn)
                container.appendChild(sentinelContainer)
            }

            updateVisibility(currentVisibleCount)

            const performScroll = (targetElement) => {
                if ('scrollRestoration' in history) {
                    history.scrollRestoration = 'manual'
                }

                const navHeader = document.querySelector('.VPNav')
                const navHeight = navHeader ? navHeader.getBoundingClientRect().height : 64

                const rect = targetElement.getBoundingClientRect()
                const absoluteTop = rect.top + window.scrollY
                const targetY = Math.max(0, absoluteTop - navHeight - 16)

                window.scrollTo({
                    top: targetY,
                    behavior: 'smooth'
                })
            }

            const handleHashJump = (hash) => {
                if (!hash) return
                const targetId = decodeURIComponent(hash.replace('#', ''))
                const targetIndex = versionItems.findIndex(el => el.id === targetId)

                if (targetIndex !== -1) {
                    const neededCount = targetIndex + 1 + BUFFER_THRESHOLD
                    const requiredGroups = Math.ceil(neededCount / PAGE_SIZE)
                    const targetVisibleCount = requiredGroups * PAGE_SIZE

                    if (targetVisibleCount > currentVisibleCount) {
                        currentVisibleCount = targetVisibleCount
                        updateVisibility(currentVisibleCount)
                    }

                    nextTick(() => {
                        requestAnimationFrame(() => {
                            performScroll(versionItems[targetIndex])
                        })
                    })
                }
            }

            clickHandler = (e) => {
                const link = e.target.closest('a[href*="#"]')
                if (link) {
                    const href = link.getAttribute('href')
                    if (!href || href === '#') return

                    const hash = href.substring(href.indexOf('#'))
                    const targetId = decodeURIComponent(hash.replace('#', ''))

                    if (document.getElementById(targetId)) {
                        e.preventDefault()
                        e.stopPropagation()

                        if (window.location.hash !== hash) {
                            history.pushState(null, '', hash)
                        }

                        handleHashJump(hash)
                    }
                }
            }

            document.addEventListener('click', clickHandler, true)

            hashHandler = () => handleHashJump(window.location.hash)
            window.addEventListener('hashchange', hashHandler)

            if (window.location.hash) {
                setTimeout(() => {
                    handleHashJump(window.location.hash)
                }, 100)
            }

            if (import.meta.env?.DEV) {
                const docEl = document.querySelector('.vp-doc')
                if (docEl) {
                    docMutationObserver = new MutationObserver(() => {
                        docMutationObserver.disconnect()
                        nextTick(() => initChangelogPagination())
                    })
                    docMutationObserver.observe(docEl, {childList: true})
                }
            }
        }

        onMounted(() => {
            initChangelogPagination()
        })

        onUnmounted(() => {
            cleanup()
        })

        watch(() => route.path, () => {
            nextTick(() => initChangelogPagination())
        })
    }
}
