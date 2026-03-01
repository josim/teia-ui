import { Button } from '@atoms/button'
import { useUserStore } from '@context/userStore'

export default function SendMessageButton({ address }) {
  const userAddress = useUserStore((st) => st.address)

  if (!userAddress || userAddress === address) {
    return null
  }

  return (
    <Button to={`/messages/compose/${address}`} small secondary>
      Send Message
    </Button>
  )
}
