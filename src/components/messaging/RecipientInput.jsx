import { useState, useEffect } from 'react'
import { validateAddress } from '@taquito/utils'
import { getUser } from '@data/api'
import styles from './RecipientInput.module.scss'

export default function RecipientInput({ value, onChange, onRemove, index }) {
  const [alias, setAlias] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!value || value.length < 36) {
      setAlias('')
      setError('')
      return
    }

    const validation = validateAddress(value)
    if (validation !== 3) {
      setError('Invalid address')
      setAlias('')
      return
    }

    setError('')

    getUser(value).then((user) => {
      if (user?.name) {
        setAlias(user.name)
      } else {
        setAlias('')
      }
    })
  }, [value])

  return (
    <div className={styles.row}>
      <input
        className={styles.address_input}
        type="text"
        placeholder="tz1... or KT1..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {alias && <span className={styles.alias}>{alias}</span>}
      {error && <span className={styles.error}>{error}</span>}
      {onRemove && (
        <button
          className={styles.remove_btn}
          onClick={() => onRemove(index)}
          type="button"
          aria-label="Remove recipient"
        >
          &times;
        </button>
      )}
    </div>
  )
}
