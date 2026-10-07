import { useState } from 'react'
import { Button, ErrorText, Field, Heading, Muted, Screen } from '../../components/ui'
import { errorMessage, requestPasswordReset } from '../../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email.trim()) return setError('Renseignez votre email')
    setError(null)
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <Heading>Réinitialiser le mot de passe</Heading>
      {sent ? (
        <Muted>
          Si un compte existe pour cet email, vous allez recevoir un lien de réinitialisation. Ouvrez-le pour choisir un nouveau mot de passe, puis revenez vous connecter.
        </Muted>
      ) : (
        <>
          <Muted style={{ marginBottom: 20 }}>Nous vous enverrons un lien de réinitialisation par email.</Muted>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
          <ErrorText>{error}</ErrorText>
          <Button title="Envoyer le lien" onPress={submit} loading={loading} />
        </>
      )}
    </Screen>
  )
}
