import { create } from 'zustand'
import {
  persist,
  createJSONStorage,
  subscribeWithSelector,
} from 'zustand/middleware'
import { validateAddress } from '@taquito/utils'
import { MODERATOR_CONTRACT } from '@constants'
import { Tezos, useUserStore } from './userStore'
import { useModalStore } from './modalStore'

type OperationReturn = Promise<string | undefined>

interface ModeratorState {
  /** Submits a moderator proposal (add_moderator, remove_moderator, update_multisig_address) */
  submitProposal: (action: any, callback?: any) => OperationReturn
  /** Votes on a moderator proposal */
  voteProposal: (proposalId: number, approval: boolean, callback?: any) => OperationReturn
  /** Executes a moderator proposal */
  executeProposal: (proposalId: number, callback?: any) => OperationReturn
}

export const useModeratorStore = create<ModeratorState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        submitProposal: async (action, callback) => {
          const handleOp = useUserStore.getState().handleOp
          const show = useModalStore.getState().show
          const showError = useModalStore.getState().showError
          const step = useModalStore.getState().step

          const modalTitle = 'Submit moderator proposal'

          // Validate address for address-based actions
          const address = action.add_moderator || action.remove_moderator || action.update_multisig_address
          if (address && validateAddress(address) !== 3) {
            show(modalTitle, `The provided address is not a valid tezos address: ${address}`)
            return
          }

          step(modalTitle, 'Waiting for confirmation', true)

          try {
            const contract = await Tezos.wallet.at(MODERATOR_CONTRACT)
            const batch = contract.methodsObject.submit_proposal(action)
            const opHash = await handleOp(batch, modalTitle)

            callback?.()

            return opHash
          } catch (e) {
            showError(modalTitle, e)
          }
        },
        voteProposal: async (proposalId, approval, callback) => {
          const handleOp = useUserStore.getState().handleOp
          const showError = useModalStore.getState().showError
          const step = useModalStore.getState().step

          const modalTitle = 'Vote moderator proposal'
          step(modalTitle, 'Waiting for confirmation', true)

          try {
            const contract = await Tezos.wallet.at(MODERATOR_CONTRACT)
            const parameters = {
              proposal_id: proposalId,
              approval: approval,
            }
            const batch = contract.methodsObject.vote_proposal(parameters)
            const opHash = await handleOp(batch, modalTitle)

            callback?.()

            return opHash
          } catch (e) {
            showError(modalTitle, e)
          }
        },
        executeProposal: async (proposalId, callback) => {
          const handleOp = useUserStore.getState().handleOp
          const showError = useModalStore.getState().showError
          const step = useModalStore.getState().step

          const modalTitle = 'Execute moderator proposal'
          step(modalTitle, 'Waiting for confirmation', true)

          try {
            const contract = await Tezos.wallet.at(MODERATOR_CONTRACT)
            const batch = contract.methods.execute_proposal(proposalId)
            const opHash = await handleOp(batch, modalTitle)

            callback?.()

            return opHash
          } catch (e) {
            showError(modalTitle, e)
          }
        },
      }),
      {
        name: 'moderator',
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
)
