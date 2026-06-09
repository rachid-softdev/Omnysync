// Declaration for stripe package
// Stripe ships its own types, this stub is for environments where types aren't resolved
declare module 'stripe' {
  class Stripe {
    constructor(secretKey: string, options?: Record<string, unknown>)
    checkout: {
      sessions: {
        create(params: Record<string, unknown>): Promise<Record<string, unknown>>
      }
    }
    billingPortal: {
      sessions: {
        create(params: Record<string, unknown>): Promise<Record<string, unknown>>
      }
    }
    webhooks: {
      constructEvent(
        payload: Buffer | string,
        signature: string,
        secret: string
      ): Record<string, unknown>
    }
    prices: {
      retrieve(priceId: string): Promise<Record<string, unknown>>
    }
  }
  export default Stripe
}
