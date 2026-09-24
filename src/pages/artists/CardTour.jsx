import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CloseIcon } from '@icons'
import styles from './index.module.scss'

const PAD = 4 // spotlight outline sits this far outside the target

/**
 * Walkthrough rendered over the page while the URL has `?tour`. Each step
 * highlights the element marked `data-tour="<target>"`. A step without
 * `next` waits for the user to act (e.g. click a link that keeps `?tour`).
 * `align: 'right'` lines the popover's right edge up with the target's.
 */
export default function CardTour({ steps }) {
  const [params, setParams] = useSearchParams()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const active = params.has('tour')
  const step = steps[i]

  useEffect(() => {
    if (!active) return
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    const measure = () => setRect(el.getBoundingClientRect())
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [active, step])

  if (!active || !rect) return null

  const end = () => {
    params.delete('tour')
    setParams(params)
    setI(0)
  }
  const last = i === steps.length - 1 && step.next !== false

  return (
    <>
      <div
        className={styles.tour_spot}
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }}
      />
      <div
        className={`${styles.tour_pop} ${
          step.align === 'right' ? styles.tour_pop_right : ''
        }`}
        style={
          step.align === 'right'
            ? {
                top: rect.bottom + 12,
                right: Math.max(
                  16,
                  document.documentElement.clientWidth - rect.right - PAD
                ),
              }
            : {
                top: rect.bottom + 12,
                left: Math.max(
                  16,
                  Math.min(rect.left - PAD, window.innerWidth - 296)
                ),
              }
        }
      >
        <button
          type="button"
          className={styles.tour_close}
          onClick={end}
          aria-label="Close tour"
        >
          <CloseIcon fill="var(--text-color)" width="10" />
        </button>
        <p>{step.text}</p>
        <div className={styles.tour_actions}>
          {i > 0 && (
            <button type="button" onClick={() => setI(i - 1)}>
              Back
            </button>
          )}
          {step.next !== false && !last && (
            <button type="button" onClick={() => setI(i + 1)}>
              Next
            </button>
          )}
          {last && (
            <button type="button" onClick={end}>
              Done
            </button>
          )}
        </div>
      </div>
    </>
  )
}
