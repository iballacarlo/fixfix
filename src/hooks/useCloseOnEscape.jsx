import { useEffect } from 'react'

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTORS))
    .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')
}

export default function useCloseOnEscape(isOpen, onClose, modalRef = null) {
  useEffect(() => {
    if (!isOpen) return

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null

    function handleKeyDown(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key === 'Tab' && modalRef?.current) {
        const focusable = getFocusableElements(modalRef.current)
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    if (modalRef?.current) {
      const focusable = getFocusableElements(modalRef.current)
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        modalRef.current.tabIndex = -1
        modalRef.current.focus()
      }
    }

    const originalBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalBodyOverflow
      if (previousActiveElement?.focus) previousActiveElement.focus()
    }
  }, [isOpen, onClose, modalRef])
}
