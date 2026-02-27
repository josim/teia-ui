import { useState } from 'react'
import { MODERATOR_CONTRACT } from '@constants'
import { useUserStore } from '@context/userStore'
import { useModeratorStore } from '@context/moderatorStore'
import { Button } from '@atoms/button'
import { Line } from '@atoms/line'
import { Select } from '@atoms/select'
import { SimpleInput } from '@atoms/input'
import {
  useStorage,
  useModeratorProposals,
  useMultisigAddresses,
} from '@data/swr'
import { Loading } from '@atoms/loading'
import styles from '@style'

const ACTION_TYPES = {
  add_moderator: 'Add moderator',
  remove_moderator: 'Remove moderator',
  update_multisig_address: 'Update multisig address',
}

export default function SubmitModeratorProposal() {
  const [selectedAction, setSelectedAction] = useState('add_moderator')
  const [address, setAddress] = useState('')

  const [moderatorStorage] = useStorage(MODERATOR_CONTRACT)
  const [, updateProposals] = useModeratorProposals(moderatorStorage)

  const userAddress = useUserStore((st) => st.address)
  const multisigAddresses = useMultisigAddresses()
  const isMultisig = multisigAddresses.includes(userAddress)

  const submitProposal = useModeratorStore((st) => st.submitProposal)

  if (!moderatorStorage) {
    return (
      <div className={styles.loading_container}>
        <Loading message="Loading moderator information" />
      </div>
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const action = { [selectedAction]: address }
    submitProposal(action, () => {
      updateProposals()
      setAddress('')
    })
  }

  return (
    <section className={styles.section}>
      <h1 className={styles.section_title}>Submit a new moderator proposal</h1>

      {!isMultisig ? (
        <p>Only multisig members can submit moderator proposals.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <Select
            alt="action type selection"
            value={{
              value: selectedAction,
              label: ACTION_TYPES[selectedAction],
            }}
            onChange={(e) => setSelectedAction(e.value)}
            options={Object.entries(ACTION_TYPES).map(([value, label]) => ({
              value,
              label,
            }))}
          >
            <Line />
          </Select>

          <SimpleInput
            type="text"
            label="Tezos address"
            placeholder="tz1... or KT1..."
            minlength="36"
            maxlength="36"
            value={address}
            onChange={setAddress}
          >
            <Line />
          </SimpleInput>

          <Button shadow_box fit>
            Submit proposal
          </Button>
        </form>
      )}
    </section>
  )
}
