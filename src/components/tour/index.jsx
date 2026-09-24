import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CloseIcon } from '@icons'
import styles from './index.module.scss'

const PAD = 4 // spotlight outline sits this far outside the target

/**
 * Walkthrough rendered over the page while the URL has `?tour=<name>`. Each
 * step highlights the element marked `data-tour="<target>"`. A step with
 * `next: false` waits for the user to act (e.g. click a link that keeps
 * `?tour=<name>`). `align: 'right'` lines the popover's right edge up with
 * the target's; `above: true` places it above the target instead of below.
 */
export default function Tour({ name, steps }) {
  const [params, setParams] = useSearchParams()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const active = params.get('tour') === name
  const step = steps[i]

  const end = () => {
    params.delete('tour')
    setParams(params)
    setI(0)
  }

  useEffect(() => {
    if (!active) return setI(0)
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    // Target not on the page (e.g. no previewable items): skip the step,
    // or finish if it was the last one.
    if (!el) {
      setRect(null)
      if (i < steps.length - 1) setI(i + 1)
      else end()
      return
    }
    const measure = () => setRect(el.getBoundingClientRect())
    // Wait a frame: a parent may still be about to show the target (e.g. a
    // dialog calling showModal() in its own effect, which runs after ours).
    const frame = requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'center' })
      measure()
    })
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step])

  if (!active || !rect) return null

  const last = i === steps.length - 1 && step.next !== false

  return (
    <>
      <div
        className={styles.spot}
        style={{
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
        }}
      />
      <div
        className={`${styles.pop} ${
          step.align === 'right' ? styles.pop_right : ''
        } ${step.above ? styles.pop_above : ''}`}
        style={{
          ...(step.above
            ? {
                bottom: document.documentElement.clientHeight - rect.top + 12,
              }
            : { top: rect.bottom + 12 }),
          ...(step.align === 'right'
            ? {
                right: Math.max(
                  16,
                  document.documentElement.clientWidth - rect.right - PAD
                ),
              }
            : {
                left: Math.max(
                  16,
                  Math.min(rect.left - PAD, window.innerWidth - 296)
                ),
              }),
        }}
      >
        <button
          type="button"
          className={styles.close}
          onClick={end}
          aria-label="Close tour"
        >
          <CloseIcon fill="var(--text-color)" width="10" />
        </button>
        <p>{step.text}</p>
        <div className={styles.actions}>
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

/** Circled "?" that starts the tour called `name`. */
export function TourLink({ name, title = 'How it works' }) {
  return (
    <Link
      to={`?tour=${name}`}
      className={styles.help}
      title={title}
      aria-label={title}
    >
      ?
    </Link>
  )
}
