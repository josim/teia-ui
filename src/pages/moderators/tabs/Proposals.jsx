import { MODERATOR_CONTRACT } from '@constants'
import { useUserStore } from '@context/userStore'
import { useModeratorStore } from '@context/moderatorStore'
import { Button } from '@atoms/button'
import { Line } from '@atoms/line'
import { TeiaUserLink } from '@atoms/link'
import {
  useStorage,
  useModeratorProposals,
  useMultisigAddresses,
  useAliases,
} from '@data/swr'
import { getWordDate } from '@utils/time'
import styles from '@style'

function describeAction(action) {
  if (action.add_moderator) return `Add moderator: ${action.add_moderator}`
  if (action.remove_moderator)
    return `Remove moderator: ${action.remove_moderator}`
  if (action.update_multisig_address)
    return `Update multisig address: ${action.update_multisig_address}`
  if (action.update_metadata)
    return `Update metadata key: ${action.update_metadata.key}`
  return 'Unknown action'
}

function getProposalStatus(proposal) {
  if (proposal.executed) return 'EXECUTED'
  return 'OPEN'
}

export default function ModeratorProposals() {
  const [moderatorStorage] = useStorage(MODERATOR_CONTRACT)
  const [proposals, updateProposals] = useModeratorProposals(moderatorStorage)

  const userAddress = useUserStore((st) => st.address)
  const multisigAddresses = useMultisigAddresses()
  const isMultisig = multisigAddresses.includes(userAddress)

  // Collect addresses for alias lookup
  const addresses = proposals
    ? [...new Set(Object.values(proposals).map((p) => p.issuer))]
    : []
  const [aliases] = useAliases(addresses)

  const voteProposal = useModeratorStore((st) => st.voteProposal)
  const executeProposal = useModeratorStore((st) => st.executeProposal)

  if (!proposals) {
    return null
  }

  const proposalIds = Object.keys(proposals).reverse()

  return (
    <section className={styles.section}>
      <h1 className={styles.section_title}>Moderator proposals</h1>

      {proposalIds.length === 0 ? (
        <p>There are no proposals at the moment.</p>
      ) : (
        <ul>
          {proposalIds.map((proposalId, index) => {
            const proposal = proposals[proposalId]
            const status = getProposalStatus(proposal)
            const canVote = isMultisig && !proposal.executed
            const canExecute =
              isMultisig &&
              !proposal.executed &&
              parseInt(proposal.positive_votes) >=
                parseInt(proposal.minimum_votes)

            return (
              <li key={proposalId}>
                <div className={styles.proposal}>
                  <h3>
                    <span className={styles.proposal_id}>#{proposalId}</span>
                    {describeAction(proposal.action)}
                  </h3>

                  <div className={styles.proposal_information}>
                    <div>
                      <p>
                        Proposed by{' '}
                        <TeiaUserLink
                          address={proposal.issuer}
                          alias={aliases?.[proposal.issuer]}
                          shorten
                        />{' '}
                        on {getWordDate(proposal.timestamp)}.
                      </p>
                      <p>Status: {status}</p>
                      <p>
                        Votes: {proposal.positive_votes} /{' '}
                        {proposal.minimum_votes} required
                      </p>
                    </div>

                    {(canVote || canExecute) && (
                      <div>
                        {canVote && (
                          <div>
                            <p>Vote:</p>
                            <div className={styles.proposal_buttons}>
                              <Button
                                onClick={() =>
                                  voteProposal(
                                    parseInt(proposalId),
                                    true,
                                    updateProposals
                                  )
                                }
                                shadow_box
                                fit
                              >
                                yes
                              </Button>
                              <Button
                                onClick={() =>
                                  voteProposal(
                                    parseInt(proposalId),
                                    false,
                                    updateProposals
                                  )
                                }
                                shadow_box
                                fit
                              >
                                no
                              </Button>
                            </div>
                          </div>
                        )}

                        {canExecute && (
                          <div>
                            <p>Execute:</p>
                            <div className={styles.proposal_buttons}>
                              <Button
                                onClick={() =>
                                  executeProposal(
                                    parseInt(proposalId),
                                    updateProposals
                                  )
                                }
                                shadow_box
                                fit
                              >
                                execute
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {index < proposalIds.length - 1 && <Line />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
