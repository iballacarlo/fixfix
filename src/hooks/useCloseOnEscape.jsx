import { useEffect } from 'react'

export default function useCloseOnEscape(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return

    function handleEsc(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEsc)

    return () => {
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])
}
