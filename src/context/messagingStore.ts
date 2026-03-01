import { create } from 'zustand'
import {
  persist,
  createJSONStorage,
  subscribeWithSelector,
} from 'zustand/middleware'
import { char2Bytes } from '@taquito/utils'
import { TMNT_MESSAGING_CONTRACT } from '@constants'
import { Tezos, useUserStore } from './userStore'
import { useModalStore } from './modalStore'

type OperationReturn = Promise<string | undefined>

interface MessagingState {
  sendMessage: (
    content: string,
    recipients: string[],
    replyMode: string
  ) => OperationReturn
  reply: (
    threadId: number,
    content: string,
    recipients: string[]
  ) => OperationReturn
  markAsRead: (messageIds: number[]) => OperationReturn
  deleteMessage: (messageId: number) => OperationReturn
}

export const useMessagingStore = create<MessagingState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        sendMessage: async (content, recipients, replyMode) => {
          const handleOp = useUserStore.getState().handleOp
          const showError = useModalStore.getState().showError
          const step = useModalStore.getState().step

          const modalTitle = 'Send Message'
          step(modalTitle, 'Waiting for confirmation', true)

          try {
            const contract = await Tezos.wallet.at(TMNT_MESSAGING_CONTRACT)

            const parameters = {
              content: char2Bytes(content),
              recipients,
              reply_mode: { [replyMode]: [['unit']] },
            }

            const batch = contract.methodsObject.send_message(parameters)

            // Query message fee from storage
            const storage: any = await contract.storage()
            const fee = storage.message_fee
              ? storage.message_fee.toNumber()
              : 0

            const opHash = await handleOp(batch, modalTitle, {
              amount: fee,
              mutez: true,
            })

            return opHash
          } catch (e) {
            showError(modalTitle, e)
          }
        },

        reply: async (threadId, content, recipients) => {
          const handleOp = useUserStore.getState().handleOp
          const showError = useModalStore.getState().showError
          const step = useModalStore.getState().step

          const modalTitle = 'Reply to Thread'
          step(modalTitle, 'Waiting for confirmation', true)

          try {
            const contract = await Tezos.wallet.at(TMNT_MESSAGING_CONTRACT)

            const parameters = {
              thread_id: threadId,
              content: char2Bytes(content),
              recipients,
            }

            const batch = contract.methodsObject.reply(parameters)

            const storage: any = await contract.storage()
            const fee = storage.message_fee
              ? storage.message_fee.toNumber()
              : 0

            const opHash = await handleOp(batch, modalTitle, {
              amount: fee,
              mutez: true,
            })

            return opHash
          } catch (e) {
            showError(modalTitle, e)
          }
        },

        markAsRead: async (messageIds) => {
          const handleOp = useUserStore.getState().handleOp
          const showError = useModalStore.getState().showError
          const step = useModalStore.getState().step

          const modalTitle = 'Mark as Read'
          step(modalTitle, 'Waiting for confirmation', true)

          try {
            const contract = await Tezos.wallet.at(TMNT_MESSAGING_CONTRACT)
            const batch = contract.methodsObject.mark_as_read(messageIds)
            const opHash = await handleOp(batch, modalTitle)
            return opHash
          } catch (e) {
            showError(modalTitle, e)
          }
        },

        deleteMessage: async (messageId) => {
          const handleOp = useUserStore.getState().handleOp
          const showError = useModalStore.getState().showError
          const step = useModalStore.getState().step

          const modalTitle = 'Delete Message'
          step(modalTitle, 'Waiting for confirmation', true)

          try {
            const contract = await Tezos.wallet.at(TMNT_MESSAGING_CONTRACT)
            const batch = contract.methods.delete_message(messageId)
            const opHash = await handleOp(batch, modalTitle)
            return opHash
          } catch (e) {
            showError(modalTitle, e)
          }
        },
      }),
      {
        name: 'messaging',
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
)
